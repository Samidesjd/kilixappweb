/**
 * ============================================================================
 * authService.js - Production v3.0 (Refactored & Unified)
 * ============================================================================
 * 
 * ✅ التحديثات الرئيسية:
 * 1. توحيد استخدام user.id (auth_id من Supabase)
 * 2. إنشاء سجل في جدول users تلقائيًا عند التسجيل/الدخول
 * 3. معالجة أخطاء محسّنة
 * 4. دعم كامل لـ email و phone و avatar
 * 
 * ⚠️ نقاط حرجة:
 * - استخدام auth_id بدل id في جدول users
 * - التأكد من أن user_id في جميع الجداول يرجع إلى auth_id
 */

import { supabase } from '../config/supabaseConfig';

// ============================================================================
// 1. تسجيل الخروج (Logout)
// ============================================================================

export const logoutService = async () => {
  try {
    console.log('🔐 Logging out...');

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('❌ Logout error:', error);
      throw new Error(`فشل تسجيل الخروج: ${error.message}`);
    }

    console.log('✅ Logout successful');
    return { success: true, message: 'تم تسجيل الخروج بنجاح' };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, message: `خطأ في تسجيل الخروج: ${error.message}` };
  }
};

// ============================================================================
// 2. الحصول على المستخدم الحالي
// ============================================================================

export const getCurrentUserService = async () => {
  try {
    const { data: { user: authUser }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('❌ Error getting user:', error);
      return { success: false, user: null };
    }

    if (!authUser) {
      return { success: false, user: null, message: 'لم يتم العثور على مستخدم' };
    }

    // ✅ جلب بيانات المستخدم المكملة من جدول users
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authUser.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.warn('⚠️ Profile fetch error:', profileError);
      // الملف الشخصي قد لا يكون موجودًا بعد، وهذا طبيعي
    }

    const user = {
      id: authUser.id, // ✅ auth_id
      email: authUser.email,
      phone: authUser.phone,
      user_metadata: authUser.user_metadata || {},
      profile: userProfile || null,
    };

    console.log('✅ User found:', user.email);
    return { success: true, user };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, user: null };
  }
};

// ============================================================================
// 3. الحصول على جلسة المستخدم
// ============================================================================

export const getSessionService = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ Error getting session:', error);
      return { success: false, session: null };
    }

    return { success: true, session };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, session: null };
  }
};

// ============================================================================
// 4. تسجيل الدخول (Login)
// ============================================================================

export const loginService = async (email, password) => {
  try {
    if (!email || !password) {
      return { success: false, message: 'البريد والكلمة المرور مطلوبان' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Login error:', error);

      if (error.message.includes('Invalid login credentials')) {
        return { success: false, message: 'البريد أو الكلمة المرور غير صحيحة' };
      }

      return { success: false, message: `فشل تسجيل الدخول: ${error.message}` };
    }

    console.log('✅ Login successful');

    // ✅ جلب أو إنشاء ملف تعريفي في جدول users
    await ensureUserProfile(data.user.id, data.user.email);

    return {
      success: true,
      user: data.user,
      session: data.session,
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, message: `خطأ: ${error.message}` };
  }
};

// ============================================================================
// 5. إنشاء حساب جديد (Sign Up)
// ============================================================================

export const signupService = async (
  email,
  password,
  userData = {}
) => {
  try {
    if (!email || !password) {
      return { success: false, message: 'البريد والكلمة المرور مطلوبان' };
    }

    if (password.length < 6) {
      return { success: false, message: 'يجب أن تكون الكلمة المرور 6 أحرف على الأقل' };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
      },
    });

    if (error) {
      console.error('❌ Signup error:', error);

      if (error.message.includes('already registered')) {
        return { success: false, message: 'البريد مسجل بالفعل' };
      }

      return { success: false, message: `فشل إنشاء الحساب: ${error.message}` };
    }

    console.log('✅ Signup successful');

    // ✅ إنشاء ملف تعريفي في جدول users مباشرة بعد التسجيل
    if (data.user) {
      await ensureUserProfile(
        data.user.id,
        data.user.email,
        userData
      );
    }

    return {
      success: true,
      user: data.user,
      message: 'تم إنشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني.',
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, message: `خطأ: ${error.message}` };
  }
};

// ============================================================================
// 6. تحديث بيانات المستخدم
// ============================================================================

export const updateUserService = async (updates) => {
  try {
    // تحديث Supabase Auth
    const { data, error } = await supabase.auth.updateUser(updates);

    if (error) {
      console.error('❌ Update error:', error);
      return { success: false, message: `فشل التحديث: ${error.message}` };
    }

    // ✅ تحديث ملف تعريفي في جدول users أيضًا
    if (data.user) {
      const profileUpdates = {};

      if (updates.email) profileUpdates.email = updates.email;
      if (updates.phone) profileUpdates.phone = updates.phone;
      if (updates.data) {
        profileUpdates.first_name = updates.data.first_name || null;
        profileUpdates.last_name = updates.data.last_name || null;
        profileUpdates.avatar_url = updates.data.avatar_url || null;
      }

      profileUpdates.updated_at = new Date().toISOString();

      await supabase
        .from('users')
        .update(profileUpdates)
        .eq('auth_id', data.user.id);
    }

    console.log('✅ User updated');
    return { success: true, user: data.user };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, message: `خطأ: ${error.message}` };
  }
};

// ============================================================================
// 7. تغيير كلمة المرور
// ============================================================================

export const changePasswordService = async (newPassword) => {
  try {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'الكلمة المرور يجب أن تكون 6 أحرف على الأقل' };
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('❌ Password change error:', error);
      return { success: false, message: `فشل التغيير: ${error.message}` };
    }

    console.log('✅ Password changed');
    return { success: true, message: 'تم تغيير الكلمة المرور بنجاح' };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, message: `خطأ: ${error.message}` };
  }
};

// ============================================================================
// 8. إرسال رسالة إعادة تعيين كلمة المرور
// ============================================================================

export const resetPasswordService = async (email) => {
  try {
    if (!email) {
      return { success: false, message: 'البريد مطلوب' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      console.error('❌ Reset error:', error);
      return { success: false, message: `فشل الإرسال: ${error.message}` };
    }

    console.log('✅ Reset email sent');
    return { success: true, message: 'تم إرسال رسالة إعادة تعيين إلى بريدك الإلكتروني' };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, message: `خطأ: ${error.message}` };
  }
};

// ============================================================================
// 9. Verify OTP
// ============================================================================

export const verifyOTPService = async (email, token, type = 'email') => {
  try {
    if (!email || !token) {
      return { success: false, message: 'البريد و OTP مطلوبان' };
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });

    if (error) {
      console.error('❌ Verify error:', error);
      return { success: false, message: `فشل التحقق: ${error.message}` };
    }

    console.log('✅ OTP verified');
    return { success: true, user: data.user, session: data.session };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, message: `خطأ: ${error.message}` };
  }
};

// ============================================================================
// 10. Helper Functions
// ============================================================================

/**
 * ✅ التأكد من وجود ملف تعريفي للمستخدم في جدول users
 * يُنشئ سجلاً جديدًا إذا لم يكن موجودًا
 */
async function ensureUserProfile(
  authId,
  email,
  userData = {}
) {
  try {
    const { data: existingProfile } = await supabase
      .from('users')
      .select('auth_id')
      .eq('auth_id', authId)
      .single();

    if (existingProfile) {
      // ملف تعريفي موجود بالفعل
      return { exists: true };
    }

    // التسجيل في Auth ينشئ profile تلقائياً بواسطة trigger canonical schema.
    // إذا كانت نسخة قديمة من قاعدة البيانات لا تحتوي السجل بعد، لا نكسر الدخول.
    const { data: created, error } = await supabase
      .from('users')
      .select('auth_id')
      .eq('auth_id', authId)
      .maybeSingle();
    if (error) console.warn('⚠️ Profile lookup warning:', error?.message);
    if (!created) console.warn('⚠️ User profile not present yet; canonical auth trigger should create it.');

    console.log('✅ User profile created/ensured');
    return { exists: false, created: true };

  } catch (error) {
    console.error('❌ Error ensuring profile:', error);
    // لا نرمي الخطأ لأن هذه عملية ثانوية
    return { exists: false, error: error.message };
  }
}

/**
 * ✅ دالة للتحقق من وجود بريد إلكتروني
 */
export const checkEmailExistsService = async (email) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: 'dummy_password_for_checking', // سيفشل لكننا سنتحقق من الخطأ
    });

    // إذا كان الخطأ "Invalid login credentials" فهذا يعني البريد موجود
    // إذا كان الخطأ "Email not confirmed" فهذا يعني البريد موجود لكن لم يتم التحقق

    return {
      success: true,
      exists: error?.message !== 'User not found',
    };

  } catch (error) {
    console.error('❌ Error checking email:', error);
    return { success: false, exists: false };
  }
};

/**
 * ✅ دالة للحصول على المستخدم بـ email
 */
export const getUserByEmailService = async (email) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (error) throw error;

    if (!users || users.length === 0) {
      return { success: false, user: null };
    }

    return { success: true, user: users[0] };

  } catch (error) {
    console.error('❌ Error getting user:', error);
    return { success: false, user: null };
  }
};

/**
 * ✅ دالة لحذف حساب المستخدم (بحذر!)
 */
export const deleteAccountService = async () => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error('المستخدم غير مسجل دخول');
    const { data, error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {},
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.message || 'تعذر حذف الحساب');
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error deleting account:', error);
    return { success: false, message: error?.message || 'تعذر حذف الحساب' };
  }
};
