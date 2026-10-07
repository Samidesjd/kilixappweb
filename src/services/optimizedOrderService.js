// Canonical order service compatibility layer.
// All writes go through the same server-side RPCs used by OrderScreen/CreateStoreScreen.
import { supabase } from '../config/supabaseConfig';
import { merchantUpdateOrderStatus, confirmOrderReceived } from './orderService';

export const updateOrderStatusOptimized = async (orderId, newStatus, options = {}, onOptimisticUpdate = null) => {
  try {
    if (typeof onOptimisticUpdate === 'function') onOptimisticUpdate({ id: orderId, status: newStatus, ...options });
    const updated = await merchantUpdateOrderStatus(orderId, newStatus);
    if (typeof onOptimisticUpdate === 'function') onOptimisticUpdate(updated);
    return { success: true, data: updated };
  } catch (error) {
    return { success: false, error: error?.message || 'تعذر تحديث الطلبية' };
  }
};

export const updateOrderStatusWithDebounce = async (orderId, newStatus, options = {}, onOptimisticUpdate = null) => {
  return updateOrderStatusOptimized(orderId, newStatus, options, onOptimisticUpdate);
};

const makeUniqueChannelSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const subscribeToBuyerOrders = (buyerId, onOrdersUpdate) => {
  if (!buyerId || typeof onOrdersUpdate !== 'function') return () => {};
  const channel = supabase
    .channel(`buyer-orders:${buyerId}:${makeUniqueChannelSuffix()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${buyerId}` },
      onOrdersUpdate,
    );
  channel.subscribe();
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    void supabase.removeChannel(channel);
  };
};

export const subscribeToSellerOrders = (storeId, onOrdersUpdate) => {
  if (!storeId || typeof onOrdersUpdate !== 'function') return () => {};
  const channel = supabase
    .channel(`seller-orders:${storeId}:${makeUniqueChannelSuffix()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
      onOrdersUpdate,
    );
  channel.subscribe();
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    void supabase.removeChannel(channel);
  };
};

export { confirmOrderReceived };
