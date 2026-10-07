// قارئ PNG محلي وبسيط: يستخرج أبعاد الصورة وقيم البكسل (RGBA) من ملف PNG خام.
// مبني بالكامل هنا فوق utils/inflate.js، بدون أي مكتبة خارجية أو خدمة سحابية.
// يُستعمل فقط لتحليل صورة مصغّرة (بضع عشرات من البكسلات) لغرض استخراج
// اللون السائد فيها — لا علاقة له بأي ذكاء اصطناعي.

import { inflateZlib } from './inflate';

const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function readUint32BE(bytes, offset) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * يفك ملف PNG خام (Uint8Array) ويُعيد { width, height, pixels } حيث pixels
 * هي Uint8Array بترتيب RGBA متتالٍ (4 بايتات لكل بكسل).
 */
export function decodePNG(bytes) {
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
    throw new Error('ليس ملف PNG صالحاً');
  }

  let pos = 8; // تجاوز توقيع PNG
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let interlace = 0;
  const idatChunks = [];

  while (pos + 8 <= bytes.length) {
    const len = readUint32BE(bytes, pos);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const dataStart = pos + 8;

    if (type === 'IHDR') {
      width = readUint32BE(bytes, dataStart);
      height = readUint32BE(bytes, dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
      interlace = bytes[dataStart + 12];
    } else if (type === 'IDAT') {
      idatChunks.push(bytes.subarray(dataStart, dataStart + len));
    } else if (type === 'IEND') {
      break;
    }

    pos = dataStart + len + 4; // تجاوز البيانات + CRC
  }

  if (interlace !== 0) throw new Error('صيغة PNG متشابكة (interlaced) غير مدعومة');
  if (bitDepth !== 8) throw new Error('عمق ألوان PNG غير مدعوم');

  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (!channels) throw new Error('نوع ألوان PNG غير مدعوم');

  let totalLen = 0;
  idatChunks.forEach((c) => { totalLen += c.length; });
  const idat = new Uint8Array(totalLen);
  let off = 0;
  idatChunks.forEach((c) => { idat.set(c, off); off += c.length; });

  const raw = inflateZlib(idat);

  const stride = width * channels;
  const pixels = new Uint8Array(width * height * 4);
  let rawPos = 0;
  let prevLine = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const filterType = raw[rawPos];
    rawPos += 1;
    const line = raw.subarray(rawPos, rawPos + stride);
    rawPos += stride;
    const outLine = new Uint8Array(stride);

    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? outLine[x - channels] : 0;
      const b = prevLine[x];
      const c = x >= channels ? prevLine[x - channels] : 0;
      let val = line[x];

      switch (filterType) {
        case 0: break;
        case 1: val = (val + a) & 0xff; break;
        case 2: val = (val + b) & 0xff; break;
        case 3: val = (val + Math.floor((a + b) / 2)) & 0xff; break;
        case 4: val = (val + paethPredictor(a, b, c)) & 0xff; break;
        default: throw new Error('نوع فلترة PNG غير صالح');
      }
      outLine[x] = val;
    }

    for (let px = 0; px < width; px += 1) {
      const srcIdx = px * channels;
      const outIdx = (y * width + px) * 4;
      let r;
      let g;
      let bch;
      let a;
      if (channels === 4) {
        r = outLine[srcIdx]; g = outLine[srcIdx + 1]; bch = outLine[srcIdx + 2]; a = outLine[srcIdx + 3];
      } else if (channels === 3) {
        r = outLine[srcIdx]; g = outLine[srcIdx + 1]; bch = outLine[srcIdx + 2]; a = 255;
      } else if (channels === 2) {
        r = outLine[srcIdx]; g = r; bch = r; a = outLine[srcIdx + 1];
      } else {
        r = outLine[srcIdx]; g = r; bch = r; a = 255;
      }
      pixels[outIdx] = r; pixels[outIdx + 1] = g; pixels[outIdx + 2] = bch; pixels[outIdx + 3] = a;
    }

    prevLine = outLine;
  }

  return { width, height, pixels };
}
