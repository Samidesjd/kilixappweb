// محرك البحث بالصورة — معالجة برمجية محلية بحتة، بدون أي ذكاء اصطناعي
// أو خدمة سحابية مدفوعة:
//
// 1) نُصغّر الصورة التي اختارها المستخدم إلى أبعاد صغيرة جداً (عبر
//    expo-image-manipulator، وهي مكتبة رسمية ضمن Expo وليست خدمة ذكاء
//    اصطناعي) للحصول على PNG بترميز base64.
// 2) نفكّ ترميز الـ PNG محلياً (utils/pngDecoder.js + utils/inflate.js،
//    مكتوبة بالكامل في هذا المشروع) لاستخراج قيم البكسل الفعلية.
// 3) نحسب متوسط اللون (dominant color) لهذه البكسلات.
// 4) نقارن هذا اللون ببيانات الألوان/الوسوم الوصفية المخزَّنة مسبقاً مع كل
//    منتج في Firestore (حقل `colors` الذي يختاره التاجر عند إضافة المنتج،
//    بالإضافة إلى عنوان/وصف المنتج كوسوم نصية) ونرتّب المنتجات حسب الأقرب.

import * as ImageManipulator from 'expo-image-manipulator';
import { base64ToUint8Array } from './base64';
import { decodePNG } from './pngDecoder';
import { colorDistance, getNearestColorName, COLOR_NAME_TO_RGB, normalizeColorLabel } from './colorNames';

// نُصغّر الصورة لعرض صغير جداً — يكفي لالتقاط اللون السائد ويُبقي فكّ الترميز
// المحلي سريعاً جداً (بضع عشرات من البكسلات فقط).
const ANALYSIS_WIDTH = 24;

// أقل قيمة شفافية (alpha) نعتبر عندها البكسل "مرئياً" ونحتسبه في المتوسط
const ALPHA_VISIBILITY_THRESHOLD = 32;

/**
 * يستخرج اللون السائد (RGB) من صورة محليّة عبر uri، مع أقرب اسم لون عربي معروف.
 * @param {string} uri - مسار الصورة المحلية (من expo-image-picker)
 * @returns {Promise<{ rgb: {r:number,g:number,b:number}, name: string|null }>}
 */
export async function extractDominantColorFromUri(uri) {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: ANALYSIS_WIDTH } }],
    { base64: true, format: ImageManipulator.SaveFormat.PNG }
  );

  if (!manipulated?.base64) {
    throw new Error('تعذّر الحصول على بيانات الصورة لتحليلها محلياً');
  }

  const bytes = base64ToUint8Array(manipulated.base64);
  const { width, height, pixels } = decodePNG(bytes);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  const totalPixels = width * height;
  for (let i = 0; i < totalPixels; i += 1) {
    const idx = i * 4;
    const alpha = pixels[idx + 3];
    if (alpha < ALPHA_VISIBILITY_THRESHOLD) continue; // تجاهل وحدات البكسل الشفافة تقريباً
    rSum += pixels[idx];
    gSum += pixels[idx + 1];
    bSum += pixels[idx + 2];
    count += 1;
  }

  if (count === 0) {
    throw new Error('لم يتم العثور على بكسلات مرئية في الصورة');
  }

  const rgb = {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
  };

  return { rgb, name: getNearestColorName(rgb) };
}

// يبني قائمة قيم RGB المرشّحة لمنتج معيّن انطلاقاً من وسوم الألوان المخزَّنة معه
function buildProductColorCandidates(product) {
  const candidates = [];
  (product.colors || []).forEach((label) => {
    const key = normalizeColorLabel(label);
    if (COLOR_NAME_TO_RGB[key]) candidates.push(COLOR_NAME_TO_RGB[key]);
  });
  return candidates;
}

// درجة "بُعد" المنتج عن اللون المطلوب — كلما قلّت كان المنتج أقرب تطابقاً.
// نعتمد أولاً على وسوم الألوان الصريحة للمنتج، ثم نُحسّن النتيجة إذا ظهر
// اسم اللون نفسه ضمن عنوان أو وصف المنتج (تطابق كلمات مفتاحية بسيط).
function scoreProductDistance(product, queryRgb, queryName) {
  const candidates = buildProductColorCandidates(product);
  const text = `${product.title || ''} ${product.description || ''}`;
  const keywordMatch = !!queryName && text.includes(queryName);

  let bestDistance = Infinity;
  candidates.forEach((rgb) => {
    const d = colorDistance(rgb, queryRgb);
    if (d < bestDistance) bestDistance = d;
  });

  if (bestDistance === Infinity) {
    // لا توجد وسوم لونية صريحة على المنتج — نعتمد فقط على تطابق الكلمات المفتاحية
    return keywordMatch ? 140 : 320;
  }

  return keywordMatch ? Math.max(0, bestDistance - 40) : bestDistance;
}

/**
 * يرتّب قائمة منتجات حسب مدى قرب لونها السائد/وسومها من اللون المستخرج من صورة المستخدم.
 * @param {Array} products
 * @param {{r:number,g:number,b:number}} queryRgb
 * @param {string|null} queryName
 * @param {number} limit
 */
export function searchProductsByColor(products, queryRgb, queryName, limit = 12) {
  const scored = products.map((product) => ({
    product,
    distance: scoreProductDistance(product, queryRgb, queryName),
  }));
  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, limit).map((s) => s.product);
}
