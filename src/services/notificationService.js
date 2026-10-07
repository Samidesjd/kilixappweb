import { supabase } from '../config/supabaseConfig';

const mapNotification = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  date: row.created_at,
  read: !!row.read,
  orderId: row.order_id,
  productId: row.product_id,
  storeId: row.store_id,
  chatId: row.chat_id,
});

export async function getNotifications(userId, { limit = 50, offset = 0 } = {}) {
  if (!userId) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).range(safeOffset, safeOffset + safeLimit - 1);
  if (error) throw error;
  return (data || []).map(mapNotification);
}

export async function getUnreadNotificationsCount(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
  return Number(count) || 0;
}

export async function markNotificationRead(notificationId, userId) {
  if (!notificationId || !userId) throw new Error('بيانات الإشعار غير مكتملة');
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId).eq('user_id', userId);
  if (error) throw error;
  return true;
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return true;
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  if (error) throw error;
  return true;
}

export async function getReviewCoupon(reviewId) {
  if (!reviewId) return null;
  const { data, error } = await supabase.from('coupons').select('id,code,amount').eq('review_id', reviewId).maybeSingle();
  if (error) throw error;
  return data || null;
}

export { mapNotification };
export default { getNotifications, getUnreadNotificationsCount, markNotificationRead, markAllNotificationsRead, getReviewCoupon };
