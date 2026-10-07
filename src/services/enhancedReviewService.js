import ReviewService from './reviewService';

export const submitProductReviewEnhanced = async ({ orderId, rating, comment, userId }) => ReviewService.submitOrderReview({ orderId, rating, comment });
export const getFilteredReviewsEnhanced = async (productId, limit = 4) => ReviewService.getProductReviews(productId, limit);
export const getAllProductReviews = async (productId, limit = 100) => ReviewService.getProductReviews(productId, limit);
export const getCommentIndicesToShow = (totalCount) => totalCount > 0 ? [0] : [];
export const getComprehensiveRatingStats = async (productId) => {
  const [rating, reviews] = await Promise.all([ReviewService.getProductRating(productId), ReviewService.getProductReviews(productId, 4)]);
  return { average: rating.average, count: rating.count, filteredReviews: reviews, distribution: {1:0,2:0,3:0,4:0,5:0} };
};
export const subscribeToProductReviews = (productId, onReviewUpdate) => {
  if (!productId || typeof onReviewUpdate !== 'function') return () => {};
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = ReviewRealtime.supabase
    .channel(`reviews:${productId}:${uniqueSuffix}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_reviews', filter: `product_id=eq.${productId}` },
      onReviewUpdate
    );
  channel.subscribe((status) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
      console.warn('[Realtime] enhanced reviews channel status:', status, productId);
    }
  });
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    void ReviewRealtime.supabase.removeChannel(channel);
  };
};
import { supabase } from '../config/supabaseConfig';
const ReviewRealtime = { supabase };
export const deleteReviewEnhanced = async () => ({ success: false, error: 'حذف التقييم غير متاح للمستخدم من التطبيق' });
export default { submitProductReviewEnhanced, getFilteredReviewsEnhanced, getAllProductReviews, getComprehensiveRatingStats, subscribeToProductReviews, deleteReviewEnhanced };
