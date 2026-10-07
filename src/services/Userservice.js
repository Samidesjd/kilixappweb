// ====================================
// User Service - Updated
// ====================================

import { supabase } from '../config/supabaseConfig';

// ✅ إنشاء حساب مستخدم جديد
export const createUserProfile = async (authId, userData = {}) => {
  try {
    const normalized = String(authId || '').trim();
    if (!normalized) throw new Error('معرف المستخدم مطلوب');
    const payload = {
      auth_id: normalized,
      email: userData.email || null,
      first_name: userData.firstName || '',
      last_name: userData.lastName || '',
      phone: userData.phone || null,
      country: userData.country || 'DZ',
      account_type: userData.accountType || 'buyer',
    };
    const { data, error } = await supabase.from('users').upsert(payload, { onConflict: 'auth_id' }).select('*').single();
    if (error) throw error;
    return { success: true, user: data, message: 'تم إنشاء/تحديث الحساب بنجاح' };
  } catch (error) {
    console.error('Error creating user profile:', error);
    return { success: false, error: error.message };
  }
};

// ✅ الحصول على بيانات المستخدم الشخصية
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single();

    if (error) throw error;

    return {
      success: true,
      user: data,
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ✅ تحديث البيانات الشخصية
export const updateUserProfile = async (userId, updateData) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      country,
      avatarUrl,
    } = updateData;

    const dataToUpdate = {
      updated_at: new Date().toISOString(),
    };

    // ✅ تحديث الحقول المتاحة فقط
    if (firstName !== undefined) dataToUpdate.first_name = firstName;
    if (lastName !== undefined) dataToUpdate.last_name = lastName;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (country !== undefined) dataToUpdate.country = country;
    if (avatarUrl !== undefined) dataToUpdate.avatar_url = avatarUrl;

    const { data, error } = await supabase
      .from('users')
      .update(dataToUpdate)
      .eq('auth_id', userId)
      .select();

    if (error) throw error;

    return {
      success: true,
      user: data[0],
      message: 'تم تحديث البيانات الشخصية',
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ✅ الحصول على الإشعارات
export const getUserNotifications = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      notifications: data,
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ✅ وضع علامة على الإشعار كمقروء
export const markNotificationAsRead = async (notificationId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
      })
      .eq('id', notificationId)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .select();

    if (error) throw error;

    return {
      success: true,
      notification: data[0],
    };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ✅ وضع علامة على جميع الإشعارات كمقروءة
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
      })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;

    return {
      success: true,
      message: 'تم وضع علامة على جميع الإشعارات',
    };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ✅ الحصول على إعدادات الإشعارات
export const getNotificationSettings = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    // A profile can legitimately exist without a notification_settings row
    // (for example, accounts created before the settings trigger/migration).
    // Do not use .single() here because PostgREST returns PGRST116 for zero rows.
    // The UI can safely use these canonical defaults, and the next update will
    // create the row through updateNotificationSettings().
    const settings = data || {
      user_id: userId,
      enabled: true,
      order_notifications: true,
      inventory_notifications: true,
      message_notifications: true,
      rating_notifications: true,
      payment_notifications: true,
      system_notifications: true,
      marketing_notifications: true,
      quiet_hours_enabled: false,
      quiet_hours_start: null,
      quiet_hours_end: null,
    };

    return {
      success: true,
      settings,
    };
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ✅ تحديث إعدادات الإشعارات
export const updateNotificationSettings = async (userId, settings) => {
  try {
    const safeSettings = Object.fromEntries(Object.entries(settings || {}).filter(([key]) => [
      'enabled','order_notifications','inventory_notifications','message_notifications','rating_notifications',
      'payment_notifications','system_notifications','marketing_notifications','quiet_hours_enabled',
      'quiet_hours_start','quiet_hours_end'
    ].includes(key)));
    const { data, error } = await supabase
      .from('notification_settings')
      .upsert({ user_id: userId, ...safeSettings }, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;
    return { success: true, settings: data, message: 'تم تحديث إعدادات الإشعارات' };
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ✅ عد الإشعارات غير المقروءة
export const getUnreadNotificationCount = async (userId) => {
  try {
    const { data, error, count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;

    return {
      success: true,
      unreadCount: count || 0,
    };
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ✅ حذف إشعار
export const deleteNotification = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;

    return {
      success: true,
      message: 'تم حذف الإشعار',
    };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ✅ حذف جميع الإشعارات
export const deleteAllNotifications = async (userId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    return {
      success: true,
      message: 'تم حذف جميع الإشعارات',
    };
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ✅ الاشتراك في الإشعارات الحقيقية
export const subscribeToNotifications = (userId, callback) => {
  if (!userId) return () => {};

  const channel = supabase
    .channel(`notifications_${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      payload => callback(payload),
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};

// ✅ حذف حساب المستخدم (بيانات شخصية آمنة)
export const deleteUserProfile = async (userId) => {
  try {
    // ✅ حذف بيانات المستخدم (لكن تبقى البيانات المرتبطة للسجلات)
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('auth_id', userId);

    if (error) throw error;

    return {
      success: true,
      message: 'تم حذف الحساب',
    };
  } catch (error) {
    console.error('Error deleting user profile:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export default {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationSettings,
  updateNotificationSettings,
  getUnreadNotificationCount,
  deleteNotification,
  deleteAllNotifications,
  subscribeToNotifications,
  deleteUserProfile,
};