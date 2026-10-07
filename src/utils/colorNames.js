// قاموس بسيط يربط أسماء الألوان (بالعربية، نفس المفردات المستعملة في نموذج
// إضافة المنتج داخل CreateStoreScreen) بقيم RGB تقريبية، لاستعماله في مطابقة
// اللون السائد لصورة المستخدم مع الألوان الموسومة على المنتجات. معالجة محلية
// بسيطة بالكامل — بدون أي ذكاء اصطناعي أو خدمة خارجية.

export const COLOR_NAME_TO_RGB = {
  // نفس الألوان المتاحة عند إنشاء منتج (CreateStoreScreen)
  'أبيض': { r: 255, g: 255, b: 255 },
  'أسود': { r: 25, g: 25, b: 25 },
  'أزرق داكن': { r: 20, g: 40, b: 90 },
  'رمادي': { r: 150, g: 150, b: 150 },
  'فضي': { r: 200, g: 200, b: 205 },
  'أسود عسكري': { r: 40, g: 45, b: 38 },

  // ألوان عامة إضافية لتحسين المطابقة النصية مع عناوين/أوصاف المنتجات
  'كحلي': { r: 27, g: 54, b: 93 },
  'أحمر': { r: 200, g: 30, b: 30 },
  'أزرق': { r: 35, g: 100, b: 200 },
  'أخضر': { r: 40, g: 140, b: 70 },
  'أصفر': { r: 230, g: 200, b: 40 },
  'برتقالي': { r: 230, g: 120, b: 30 },
  'وردي': { r: 230, g: 130, b: 170 },
  'زهري': { r: 230, g: 130, b: 170 },
  'بنفسجي': { r: 120, g: 70, b: 160 },
  'بني': { r: 110, g: 75, b: 45 },
  'ذهبي': { r: 200, g: 170, b: 80 },
  'بيج': { r: 225, g: 205, b: 170 },
};

export const NAMED_COLOR_LIST = Object.entries(COLOR_NAME_TO_RGB).map(([name, rgb]) => ({ name, rgb }));

/** المسافة الإقليدية بين لونين في فضاء RGB — كلما قلّت، كان اللونان أقرب لبعضهما */
export function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function normalizeColorLabel(label) {
  return String(label || '').trim();
}

/** يُعيد أقرب اسم لون عربي معروف لقيمة RGB معطاة */
export function getNearestColorName(rgb) {
  let best = null;
  let bestDist = Infinity;
  NAMED_COLOR_LIST.forEach(({ name, rgb: candidate }) => {
    const d = colorDistance(rgb, candidate);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  });
  return best;
}
