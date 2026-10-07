// فك ضغط DEFLATE/zlib (RFC 1950/1951) — تطبيق محلي بسيط ومكتوب بالكامل هنا،
// بدون الاعتماد على أي مكتبة خارجية (لا pako ولا zlib ولا أي شيء ثقيل).
// نحتاجه فقط لأن الصور المصغّرة التي ننتجها لتحليل الألوان تُصدَّر بصيغة PNG،
// وملفات PNG تُخزَّن بيانات البكسل مضغوطة بخوارزمية DEFLATE القياسية.
// هذا التطبيق مبني على الخوارزمية المرجعية العامة (المشابهة لـ puff.c المعروفة).

const MAXBITS = 15;

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLC_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

class BitReader {
  constructor(data) {
    this.data = data;
    this.pos = 0;
    this.bitbuf = 0;
    this.bitcnt = 0;
  }

  getBit() {
    if (this.bitcnt === 0) {
      this.bitbuf = this.data[this.pos++];
      this.bitcnt = 8;
    }
    const bit = this.bitbuf & 1;
    this.bitbuf >>= 1;
    this.bitcnt -= 1;
    return bit;
  }

  getBits(n) {
    let val = 0;
    for (let i = 0; i < n; i += 1) {
      val |= this.getBit() << i;
    }
    return val;
  }

  alignToByte() {
    this.bitbuf = 0;
    this.bitcnt = 0;
  }
}

// بناء جدول Huffman قانوني من مصفوفة أطوال الرموز (نفس أسلوب construct() في puff.c)
function buildHuffman(lengths) {
  const counts = new Array(MAXBITS + 1).fill(0);
  for (let i = 0; i < lengths.length; i += 1) counts[lengths[i]] += 1;
  counts[0] = 0;

  const offsets = new Array(MAXBITS + 2).fill(0);
  for (let len = 1; len <= MAXBITS; len += 1) {
    offsets[len + 1] = offsets[len] + counts[len];
  }

  const symbols = new Array(lengths.length).fill(0);
  const cursor = offsets.slice();
  for (let sym = 0; sym < lengths.length; sym += 1) {
    if (lengths[sym] !== 0) {
      symbols[cursor[lengths[sym]]] = sym;
      cursor[lengths[sym]] += 1;
    }
  }

  return { counts, symbols };
}

// فك ترميز رمز Huffman واحد من التيار (نفس أسلوب decode() في puff.c)
function decodeSymbol(reader, huff) {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let len = 1; len <= MAXBITS; len += 1) {
    code |= reader.getBit();
    const count = huff.counts[len];
    if (code - first < count) {
      return huff.symbols[index + (code - first)];
    }
    index += count;
    first += count;
    first <<= 1;
    code <<= 1;
  }
  throw new Error('رمز Huffman غير صالح');
}

function fixedHuffmanTables() {
  const litLengths = new Array(288);
  let i = 0;
  for (; i < 144; i += 1) litLengths[i] = 8;
  for (; i < 256; i += 1) litLengths[i] = 9;
  for (; i < 280; i += 1) litLengths[i] = 7;
  for (; i < 288; i += 1) litLengths[i] = 8;
  const distLengths = new Array(30).fill(5);
  return { lit: buildHuffman(litLengths), dist: buildHuffman(distLengths) };
}

function dynamicHuffmanTables(reader) {
  const hlit = reader.getBits(5) + 257;
  const hdist = reader.getBits(5) + 1;
  const hclen = reader.getBits(4) + 4;

  const clLengths = new Array(19).fill(0);
  for (let i = 0; i < hclen; i += 1) {
    clLengths[CLC_ORDER[i]] = reader.getBits(3);
  }
  const clHuff = buildHuffman(clLengths);

  const lengths = [];
  while (lengths.length < hlit + hdist) {
    const sym = decodeSymbol(reader, clHuff);
    if (sym < 16) {
      lengths.push(sym);
    } else if (sym === 16) {
      const repeat = reader.getBits(2) + 3;
      const prev = lengths[lengths.length - 1] || 0;
      for (let i = 0; i < repeat; i += 1) lengths.push(prev);
    } else if (sym === 17) {
      const repeat = reader.getBits(3) + 3;
      for (let i = 0; i < repeat; i += 1) lengths.push(0);
    } else if (sym === 18) {
      const repeat = reader.getBits(7) + 11;
      for (let i = 0; i < repeat; i += 1) lengths.push(0);
    } else {
      throw new Error('رمز طول غير صالح');
    }
  }

  const litLengths = lengths.slice(0, hlit);
  const distLengths = lengths.slice(hlit, hlit + hdist);
  return { lit: buildHuffman(litLengths), dist: buildHuffman(distLengths) };
}

function inflateBlock(reader, out, litHuff, distHuff) {
  for (;;) {
    const sym = decodeSymbol(reader, litHuff);
    if (sym < 256) {
      out.push(sym);
    } else if (sym === 256) {
      return; // نهاية الكتلة
    } else {
      const lenIdx = sym - 257;
      if (lenIdx < 0 || lenIdx >= LENGTH_BASE.length) throw new Error('رمز طول تكرار غير صالح');
      const length = LENGTH_BASE[lenIdx] + reader.getBits(LENGTH_EXTRA[lenIdx]);
      const distSym = decodeSymbol(reader, distHuff);
      if (distSym < 0 || distSym >= DIST_BASE.length) throw new Error('رمز مسافة غير صالح');
      const distance = DIST_BASE[distSym] + reader.getBits(DIST_EXTRA[distSym]);
      const start = out.length - distance;
      if (start < 0) throw new Error('مسافة رجوع غير صالحة');
      for (let i = 0; i < length; i += 1) {
        out.push(out[start + i]);
      }
    }
  }
}

/**
 * يفك ضغط تيار DEFLATE خام (بدون ترويسة zlib) ويُعيد Uint8Array بالبيانات الأصلية.
 * @param {Uint8Array} data
 */
export function inflateRaw(data) {
  const reader = new BitReader(data);
  const out = [];
  let final = false;

  while (!final) {
    final = reader.getBit() === 1;
    const type = reader.getBits(2);

    if (type === 0) {
      reader.alignToByte();
      const len = reader.data[reader.pos] | (reader.data[reader.pos + 1] << 8);
      reader.pos += 4; // تجاوز LEN + NLEN
      for (let i = 0; i < len; i += 1) {
        out.push(reader.data[reader.pos++]);
      }
    } else if (type === 1) {
      const { lit, dist } = fixedHuffmanTables();
      inflateBlock(reader, out, lit, dist);
    } else if (type === 2) {
      const { lit, dist } = dynamicHuffmanTables(reader);
      inflateBlock(reader, out, lit, dist);
    } else {
      throw new Error('نوع كتلة DEFLATE غير صالح');
    }
  }

  return Uint8Array.from(out);
}

/**
 * يفك ضغط تيار zlib كامل (ترويسة بايتين + بيانات DEFLATE + Adler32 في النهاية).
 * @param {Uint8Array} zdata
 */
export function inflateZlib(zdata) {
  // نتجاوز ترويسة zlib (بايتين) ومجموع Adler32 في النهاية (4 بايتات)
  const raw = zdata.subarray(2, zdata.length - 4);
  return inflateRaw(raw);
}
