import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from './env';
import 'react-native-url-polyfill/auto';

// ✅ التحقق من وجود المتغيرات البيئية
const SUPABASE_URL = ENV?.SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ خطأ حرج: متغيرات Supabase غير مكتملة');
  console.error('تأكد من وجود EXPO_PUBLIC_SUPABASE_URL و EXPO_PUBLIC_SUPABASE_ANON_KEY في ملف .env.local');
}

// ✅ تهيئة Supabase Client بإعدادات محسّنة
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  // ✅ إضافة timeout للعمليات
  global: {
    headers: {
      'X-Client-Info': 'kilix-app',
    },
  },
});

// ✅ دالة للتحقق من اتصال Supabase
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('count(*)', { count: 'exact' })
      .limit(0);

    if (error) {
      console.error('❌ Supabase connection test failed:', error);
      return false;
    }

    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    return false;
  }
};

// ✅ دالة للتحقق من توفر Storage
export const testStorageAccess = async () => {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      console.error('❌ Storage access test failed:', error);
      return false;
    }

    console.log('✅ Storage access successful. Available buckets:', buckets?.map(b => b.name));
    return true;
  } catch (error) {
    console.error('❌ Storage access error:', error);
    return false;
  }
};

export { supabase };
export default supabase;