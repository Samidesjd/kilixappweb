import { supabase } from '../config/supabaseConfig';

export async function submitOrderReview({ orderId, rating, comment = '', images = [] }) {
  const numericRating = Number(rating);
  if (!orderId || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return { success: false, error: 'بيانات التقييم غير صالحة' };
  }
  const { data, error } = await supabase.rpc('create_order_review', {
    p_order_id: orderId,
    p_rating: numericRating,
    p_comment: String(comment || '').trim(),
    p_images: Array.isArray(images) ? images : [],
  });
  return error ? { success: false, error: error.message } : { success: true, data };
}

export async function getProductReviews(productId, limit = 4) {
  const { data, error } = await supabase.from('order_reviews').select('id,user_id,rating,comment,created_at,images').eq('product_id', productId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  const rows = data || [];
  const ids = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  if (!ids.length) return rows;
  const { data: profiles, error: profilesError } = await supabase.from('public_profiles').select('auth_id,user_code,first_name,last_name,avatar_url').in('auth_id', ids);
  if (profilesError) throw profilesError;
  const profileMap = new Map((profiles || []).map((profile) => [profile.auth_id, profile]));
  return rows.map((row) => {
    const profile = profileMap.get(row.user_id);
    return { ...row, reviewer_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.user_code || 'مستخدم', reviewer_avatar: profile?.avatar_url || null, reviewer_code: profile?.user_code || null };
  });
}

export async function getProductRating(productId) {
  const { data, error } = await supabase.from('products').select('average_rating,total_reviews').eq('id', productId).single();
  if (error) throw error;
  return { average: Number(data.average_rating) || 0, count: Number(data.total_reviews) || 0 };
}

export async function canReviewOrder(orderId) {
  const { data, error } = await supabase.from('orders').select('id,product_id,status,reviewed').eq('id', orderId).single();
  if (error) return { canReview: false, reason: error.message };
  if (data.status !== 'delivered') return { canReview: false, reason: 'الطلب لم يتم استلامه بعد' };
  if (data.reviewed) return { canReview: false, reason: 'تم تقييم الطلب مسبقاً' };
  return { canReview: true, productId: data.product_id };
}

export const ReviewService = { submitOrderReview, getProductReviews, getProductRating, canReviewOrder };
export default ReviewService;
