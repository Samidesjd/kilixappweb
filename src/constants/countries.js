// الدول المدعومة + أنواع الحسابات المتاحة لكل دولة.
// التاجر الجزائري مثلاً يشتري كـ "مستورد"، بينما المصنّع الصيني يسجّل كـ "مورّد".
// هذا الملف هو مصدر الحقيقة المحلي؛ لاحقاً يُستبدل بـ GET /countries من الـ API.

export const ACCOUNT_TYPES = {
  BUYER: 'buyer', // تاجر / مستورد (يشتري عبر المزاد العكسي)
  SUPPLIER: 'supplier', // مصنّع / مورّد صيني
};

export const ACCOUNT_TYPE_LABELS = {
  [ACCOUNT_TYPES.BUYER]: 'مستورد / تاجر',
  [ACCOUNT_TYPES.SUPPLIER]: 'مورّد / مصنّع',
};

export const COUNTRIES = [
  {
    code: 'DZ',
    name: 'الجزائر',
    dialCode: '+213',
    flag: 'https://flagcdn.com/w80/dz.png',
    currency: 'DZD',
    currencyLabel: 'دينار جزائري — DZD',
    isAvailable: true,
    availableAccountTypes: [ACCOUNT_TYPES.BUYER],
  },
  {
    code: 'TN',
    name: 'تونس',
    dialCode: '+216',
    flag: 'https://flagcdn.com/w80/tn.png',
    currency: 'TND',
    currencyLabel: 'دينار تونسي — TND',
    isAvailable: false,
    availableAccountTypes: [ACCOUNT_TYPES.BUYER],
  },
  {
    code: 'MA',
    name: 'المغرب',
    dialCode: '+212',
    flag: 'https://flagcdn.com/w80/ma.png',
    currency: 'MAD',
    currencyLabel: 'درهم مغربي — MAD',
    isAvailable: false,
    availableAccountTypes: [ACCOUNT_TYPES.BUYER],
  },
  {
    code: 'LY',
    name: 'ليبيا',
    dialCode: '+218',
    flag: 'https://flagcdn.com/w80/ly.png',
    currency: 'LYD',
    currencyLabel: 'دينار ليبي — LYD',
    isAvailable: false,
    availableAccountTypes: [ACCOUNT_TYPES.BUYER],
  },
  {
    code: 'MR',
    name: 'موريتانيا',
    dialCode: '+222',
    flag: 'https://flagcdn.com/w80/mr.png',
    currency: 'MRU',
    currencyLabel: 'أوقية موريتانية — MRU',
    isAvailable: false,
    availableAccountTypes: [ACCOUNT_TYPES.BUYER],
  },
  {
    code: 'CN',
    name: 'الصين',
    dialCode: '+86',
    flag: 'https://flagcdn.com/w80/cn.png',
    currency: 'CNY',
    currencyLabel: 'يوان صيني — CNY',
    isAvailable: false,
    availableAccountTypes: [ACCOUNT_TYPES.SUPPLIER],
  },
  {
    code: 'AE',
    name: 'الإمارات',
    dialCode: '+971',
    flag: 'https://flagcdn.com/w80/ae.png',
    currency: 'AED',
    currencyLabel: 'درهم إماراتي — AED',
    isAvailable: false,
    availableAccountTypes: [ACCOUNT_TYPES.BUYER, ACCOUNT_TYPES.SUPPLIER],
  },
  {
    code: 'SA',
    name: 'السعودية',
    dialCode: '+966',
    flag: 'https://flagcdn.com/w80/sa.png',
    currency: 'SAR',
    currencyLabel: 'ريال سعودي — SAR',
    isAvailable: false,
    availableAccountTypes: [ACCOUNT_TYPES.BUYER],
  },
];

export function getAccountTypesForCountry(countryCode) {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  return country ? country.availableAccountTypes : [ACCOUNT_TYPES.BUYER];
}
