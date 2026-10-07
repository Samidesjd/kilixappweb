// ============================================================================
// متغيرات البيئة المركزية - Kilix App with Supabase
// ============================================================================
// القيم الحقيقية (المفاتيح السرية) لا تُكتب هنا مباشرة، بل تُقرأ من ملف
// .env.local (غير مرفوع إلى Git — راجع .gitignore) عبر دعم Expo المدمج
// لمتغيرات EXPO_PUBLIC_* — بدون الحاجة لأي مكتبة إضافية مثل react-native-dotenv.
//
// للتشغيل محلياً: انسخ .env.local.example إلى .env.local وضع القيم الحقيقية.
// ============================================================================

export const ENV = {
  // ── Supabase Configuration ─────────────────────────────────────────────
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://sqvtimbmpiwlnikipicp.supabase.co',
  // This is the publishable/anon key intended for client apps. Never place the service-role key here.
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdnRpbWJtcGl3bG5pa2lwaWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDgwMTksImV4cCI6MjA3NjAyNDAxOX0.UPe-OQnA0FJtPS5P59cahE3BPcdVfUHki6SG0WKPdpU',

  // ⚠️ تحذير: Service Role Key سرية - لا تستخدمها في الـ Frontend أبداً
  // استخدمها فقط في السيرفر (Backend) إذا احتجت
  // SUPABASE_SERVICE_ROLE_KEY: 'REPLACE_WITH_SERVICE_ROLE_KEY',

  // ── API Configuration ─────────────────────────────────────────────────
  // رابط الـ API الأساسي. بدّل هذا برابط السيرفر الحقيقي (dev / staging / production).
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.kilix.dev/v1',

  // مهلة الطلبات بالميلي ثانية
  API_TIMEOUT: 15000,

  // ── Google OAuth Configuration ──────────────────────────────────────
  // مفاتيح Google OAuth — لازم تنشئها من Google Cloud Console
  // (Credentials > OAuth Client ID) لكل منصة على حدة.
  GOOGLE_PROJECT_ID: process.env.EXPO_PUBLIC_GOOGLE_PROJECT_ID || '',
  GOOGLE_CLIENT_ID_IOS: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '',
  GOOGLE_CLIENT_ID_ANDROID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '',
  GOOGLE_CLIENT_ID_WEB: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '',

  // ── Facebook Configuration ──────────────────────────────────────────
  // معرّف تطبيق Facebook — يُنشأ من Facebook for Developers
  // نفس الـ App ID يُستخدم لكل المنصات مع expo-auth-session.
  FACEBOOK_APP_ID: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || 'REPLACE_WITH_FACEBOOK_APP_ID',

  // ── OTP Configuration ───────────────────────────────────────────────
  // طول رمز التحقق (OTP) المُرسل عبر SMS أو البريد الإلكتروني
  OTP_LENGTH: 6,
  // مدة صلاحية الرمز قبل السماح بإعادة الإرسال (بالثواني)
  OTP_RESEND_SECONDS: 60,

  // ── Storage Configuration ──────────────────────────────────────────
  // Supabase Storage Buckets
  STORAGE_BUCKET_PRODUCTS: 'products',
  STORAGE_BUCKET_USERS: 'users',
  STORAGE_BUCKET_STORES: 'stores',

  // ── App Configuration ──────────────────────────────────────────────
  // إسم التطبيق
  APP_NAME: 'Kilix',
  // إصدار التطبيق
  APP_VERSION: '1.0.1',
  // اللغة الافتراضية
  DEFAULT_LANGUAGE: 'ar',
  // العملة الافتراضية
  DEFAULT_CURRENCY: 'DZD',

  // روابط عامة مطلوبة لسياسة الخصوصية وحذف الحساب خارج التطبيق
  PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || 'https://sqvtimbmpiwlnikipicp.supabase.co/functions/v1/privacy-policy-public',
  ACCOUNT_DELETION_URL: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL || 'https://sqvtimbmpiwlnikipicp.supabase.co/functions/v1/account-deletion',
};

if (__DEV__ && (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY)) {
  console.warn(
    '[env] SUPABASE_URL / SUPABASE_ANON_KEY غير موجودة. تأكد من إنشاء ملف .env.local ' +
    '(انسخه من .env.local.example) ثم أعد تشغيل التطبيق بـ: expo start -c'
  );
}

export default ENV;
