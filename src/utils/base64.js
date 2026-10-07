// فك تشفير Base64 محلياً بالكامل (بدون أي مكتبة خارجية أو خدمة سحابية).
// نحتاج هذا لأن React Native/Hermes لا يضمن وجود atob() في كل البيئات،
// وهذه الدالة تُستعمل فقط لتحويل الصورة المصغّرة (base64 PNG) إلى بايتات خام
// حتى نقدر نحلّل ألوانها برمجياً بدون أي اتصال خارجي.

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * يحوّل سلسلة base64 إلى Uint8Array من البايتات الخام.
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToUint8Array(base64) {
  const clean = String(base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  const len = clean.length;
  if (len === 0) return new Uint8Array(0);

  let bufferLength = Math.floor((len * 3) / 4);
  if (clean[len - 1] === '=') bufferLength -= 1;
  if (clean[len - 2] === '=') bufferLength -= 1;

  const bytes = new Uint8Array(Math.max(bufferLength, 0));
  let p = 0;

  for (let i = 0; i < len; i += 4) {
    const c1 = B64_CHARS.indexOf(clean[i]);
    const c2 = B64_CHARS.indexOf(clean[i + 1]);
    const c3 = clean[i + 2] === '=' || clean[i + 2] === undefined ? -1 : B64_CHARS.indexOf(clean[i + 2]);
    const c4 = clean[i + 3] === '=' || clean[i + 3] === undefined ? -1 : B64_CHARS.indexOf(clean[i + 3]);

    if (c1 < 0 || c2 < 0) break;

    bytes[p] = (c1 << 2) | (c2 >> 4);
    p += 1;

    if (c3 >= 0) {
      bytes[p] = ((c2 & 15) << 4) | (c3 >> 2);
      p += 1;
    }
    if (c4 >= 0) {
      bytes[p] = ((c3 & 3) << 6) | c4;
      p += 1;
    }
  }

  return bytes;
}
