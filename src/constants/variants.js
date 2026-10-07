// نظام خيارات المنتج الديناميكي (Variants).
// كل منتج يحمل حقل `variantGroups` (اختياري) يحدد أي المجموعات تظهر له.
// إذا ما كانش عند المنتج `variantGroups` خاصة به، نولّدها تلقائياً حسب `category`
// عبر CATEGORY_VARIANT_GROUPS تحت. هذا يخلي الواجهة تشتغل مع أي منتج مستقبلي
// بدون ما نلمس الكود، فقط نضيف تعريف الفئة أو نمرر variantGroups مخصصة للمنتج.

// كل مجموعة: { key, label, type: 'chip' | 'color' | 'size', options: [{ key, label, hex? }] }

export const VARIANT_GROUPS = {
  storage: {
    key: 'storage',
    label: 'سعة التخزين',
    type: 'chip',
    options: [
      { key: '64gb', label: '64 جيجا' },
      { key: '128gb', label: '128 جيجا' },
      { key: '256gb', label: '256 جيجا' },
      { key: '512gb', label: '512 جيجا' },
    ],
  },
  color: {
    key: 'color',
    label: 'اللون',
    type: 'color',
    options: [
      { key: 'navy', label: 'كحلي', hex: '#1B365D' },
      { key: 'orange', label: 'برتقالي', hex: '#A04100' },
      { key: 'gray', label: 'رمادي', hex: '#F4F7F9' },
      { key: 'black', label: 'أسود', hex: '#1B1C1C' },
      { key: 'white', label: 'أبيض', hex: '#FFFFFF' },
    ],
  },
  simType: {
    key: 'simType',
    label: 'نوع الشريحة',
    type: 'chip',
    options: [
      { key: 'single', label: 'شريحة واحدة' },
      { key: 'dual', label: 'شريحتان' },
      { key: 'esim', label: 'e-SIM' },
    ],
  },
  ram: {
    key: 'ram',
    label: 'الذاكرة العشوائية RAM',
    type: 'chip',
    options: [
      { key: '8gb', label: '8 جيجا' },
      { key: '16gb', label: '16 جيجا' },
      { key: '32gb', label: '32 جيجا' },
    ],
  },
  processor: {
    key: 'processor',
    label: 'المعالج',
    type: 'chip',
    options: [
      { key: 'i5', label: 'Core i5' },
      { key: 'i7', label: 'Core i7' },
      { key: 'i9', label: 'Core i9' },
      { key: 'ryzen7', label: 'Ryzen 7' },
    ],
  },
  keyboardLayout: {
    key: 'keyboardLayout',
    label: 'لغة لوحة المفاتيح',
    type: 'chip',
    options: [
      { key: 'ar_en', label: 'عربي / إنجليزي' },
      { key: 'en', label: 'إنجليزي' },
      { key: 'fr', label: 'فرنسي' },
    ],
  },
  size: {
    key: 'size',
    label: 'المقاس',
    type: 'chip',
    options: [
      { key: 's', label: 'صغير' },
      { key: 'm', label: 'متوسط' },
      { key: 'l', label: 'كبير' },
      { key: 'xl', label: 'كبير جداً' },
    ],
  },
  shoeSize: {
    key: 'shoeSize',
    label: 'المقاس',
    type: 'chip',
    options: [
      { key: '39', label: '39' },
      { key: '40', label: '40' },
      { key: '41', label: '41' },
      { key: '42', label: '42' },
      { key: '43', label: '43' },
      { key: '44', label: '44' },
    ],
  },
  material: {
    key: 'material',
    label: 'الخامة',
    type: 'chip',
    options: [
      { key: 'cotton', label: 'قطن' },
      { key: 'polyester', label: 'بوليستر' },
      { key: 'wool', label: 'صوف' },
      { key: 'leather', label: 'جلد' },
    ],
  },
  volume: {
    key: 'volume',
    label: 'الحجم',
    type: 'chip',
    options: [
      { key: '30ml', label: '30 مل' },
      { key: '50ml', label: '50 مل' },
      { key: '100ml', label: '100 مل' },
    ],
  },
  edition: {
    key: 'edition',
    label: 'الإصدار',
    type: 'chip',
    options: [
      { key: 'standard', label: 'عادي' },
      { key: 'limited', label: 'محدود' },
      { key: 'collector', label: 'نسخة هواة الجمع' },
    ],
  },
  strap: {
    key: 'strap',
    label: 'نوع السوار',
    type: 'chip',
    options: [
      { key: 'leather', label: 'جلد' },
      { key: 'metal', label: 'معدني' },
      { key: 'silicone', label: 'سيليكون' },
    ],
  },
};

// خرائط الفئة → المجموعات الافتراضية (تُستعمل فقط إذا المنتج ما عندوش variantGroups خاصة).
export const CATEGORY_VARIANT_GROUPS = {
  clothing: ['size', 'color'],
  electronics: [],
  home: [],
  construction: [],
};

const TEMPLATE_VARIANT_GROUPS = {
  clothing: ['size', 'color'],
  computer: ['ram', 'storage'],
  phone: ['ram', 'storage', 'color'],
  watch: ['color', 'size'],
  home: [],
};

/**
 * يرجع مصفوفة تعريفات المجموعات الفعلية لمنتج معيّن.
 * الأولوية لـ product.variantGroups (مصفوفة مفاتيح مخصصة)، وإلا نرجع لتعريف الفئة.
 * أي مفتاح غير معروف يُتجاهل بأمان (المنتج المستقبلي يبقى يشتغل بدون كسر الواجهة).
 */
const PRODUCT_FIELD_TO_GROUP = {
  sizes: 'size',
  colors: 'color',
  ram: 'ram',
  storage: 'storage',
};

export const COLOR_HEX_BY_NAME = {
  'أبيض': '#FFFFFF', 'white': '#FFFFFF',
  'أسود': '#111111', 'black': '#111111',
  'أحمر': '#D32F2F', 'red': '#D32F2F',
  'أخضر': '#2E7D32', 'green': '#2E7D32',
  'أزرق': '#1976D2', 'blue': '#1976D2',
  'أزرق داكن': '#0D47A1', 'navy': '#1B365D', 'كحلي': '#1B365D',
  'رمادي': '#9E9E9E', 'gray': '#9E9E9E', 'grey': '#9E9E9E',
  'فضي': '#B0BEC5', 'silver': '#B0BEC5',
  'ذهبي': '#D4AF37', 'gold': '#D4AF37',
  'برتقالي': '#F57C00', 'orange': '#F57C00',
  'أصفر': '#FBC02D', 'yellow': '#FBC02D',
  'وردي': '#EC407A', 'pink': '#EC407A',
  'بنفسجي': '#7E57C2', 'purple': '#7E57C2',
  'بني': '#795548', 'brown': '#795548',
  'بيج': '#D7CCC8', 'beige': '#D7CCC8',
  'أحمر خمري': '#7B1E2B', 'خمري': '#7B1E2B', 'burgundy': '#7B1E2B',
  'فيروزي': '#26A69A', 'turquoise': '#26A69A',
  'أزرق سماوي': '#29B6F6', 'سماوي': '#29B6F6',
  'أسود عسكري': '#30332F',
};

function getColorHex(value) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  return COLOR_HEX_BY_NAME[raw] || COLOR_HEX_BY_NAME[normalized] || '#D1D5DB';
}

function normalizeOptionKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function groupFromProductField(groupKey, values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const base = VARIANT_GROUPS[groupKey];
  if (!base) return null;
  return {
    ...base,
    options: values.map((value) => ({
      key: normalizeOptionKey(value),
      label: String(value),
      ...(groupKey === 'color' ? { hex: getColorHex(value) } : {}),
    })),
  };
}

export function getProductVariantGroups(product) {
  if (!product) return [];
  return ['sizes','colors','ram','storage']
    .map((field) => groupFromProductField(PRODUCT_FIELD_TO_GROUP[field], product[field]))
    .filter(Boolean);
}

export function isVariantCombinationAvailable(product, variants) {
  // No per-combination stock is stored in the canonical schema. Never fabricate availability.
  return !!product && !!variants && typeof variants === 'object';
}

export function getDisabledOptionKeys(product, groupKey, allGroups, currentSelection) {
  const disabled = new Set();
  const group = allGroups.find((g) => g.key === groupKey);
  if (!group) return disabled;

  const otherGroups = allGroups.filter((g) => g.key !== groupKey);
  const allOthersSelected = otherGroups.every((g) => currentSelection[g.key]);
  if (!allOthersSelected) return disabled;

  group.options.forEach((opt) => {
    const combo = { ...currentSelection, [groupKey]: opt.key };
    if (!isVariantCombinationAvailable(product, combo)) disabled.add(opt.key);
  });
  return disabled;
}

