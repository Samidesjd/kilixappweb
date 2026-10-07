// تصنيفات المنتجات الرئيسية والفرعية. تُستعمل في شاشة "التصنيفات" وفلترة الرئيسية.
// نفس الشكل المتوقع من GET /categories في الـ API الحقيقي.
// القائمة مطابقة لتصنيفات شاشة الرئيسية في تصميم Stitch (4 تصنيفات + "الكل").

export const CATEGORIES = [
  {
    id: 'electronics',
    name: 'إلكترونيات',
    icon: 'devices',
    subcategories: ['هواتف وإكسسوارات', 'أجهزة منزلية صغيرة', 'صوتيات', 'إضاءة LED'],
  },
  {
    id: 'fashion',
    name: 'نسيج وملابس',
    icon: 'checkroom',
    subcategories: ['ملابس رجالية', 'ملابس نسائية', 'أقمشة', 'إكسسوارات'],
  },
  {
    id: 'home',
    name: 'أدوات منزلية',
    icon: 'kitchen',
    subcategories: ['أدوات مطبخ', 'تخزين ومنظمة', 'مفروشات', 'ديكور'],
  },
  {
    id: 'construction',
    name: 'بناء وإنشاءات',
    icon: 'construction',
    subcategories: ['مواد بناء', 'عدد ومعدات', 'كهرباء وسباكة'],
  },
];

export function getCategoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}
