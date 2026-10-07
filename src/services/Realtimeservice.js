import { supabase } from '../config/supabaseConfig';

/**
 * ✅ الاستماع لتغييرات جدول products و orders
 */
export const useRealtimeListener = (storeId, callback) => {
  // ✅ استماع لتغييرات المنتجات
  const setupProductsListener = () => {
    try {
      console.log('🎣 Setting up products realtime listener for store:', storeId);

      const channel = supabase.channel(`realtime:products:${storeId}`, {
        config: {
          broadcast: { self: true },
        },
      });

      // ✅ إضافة مستمع INSERT
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'products',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('✅ Product INSERT:', payload.new.id);
          callback({
            type: 'products',
            event: 'INSERT',
            data: payload.new,
          });
        }
      );

      // ✅ إضافة مستمع UPDATE
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('✅ Product UPDATE:', payload.new.id);
          callback({
            type: 'products',
            event: 'UPDATE',
            data: payload.new,
          });
        }
      );

      // ✅ إضافة مستمع DELETE
      channel.on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'products',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('✅ Product DELETE:', payload.old.id);
          callback({
            type: 'products',
            event: 'DELETE',
            data: payload.old,
          });
        }
      );

      // ✅ استدعاء subscribe في النهاية
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('🔌 Realtime SUBSCRIBED to products:', storeId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Products channel error');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Products realtime timed out');
        }
      });

      return () => {
        channel.unsubscribe();
        console.log('🔌 Products listener unsubscribed');
      };
    } catch (error) {
      console.error('❌ Error setting up products channel:', error.message);
      return () => {};
    }
  };

  // ✅ استماع لتغييرات الطلبات
  const setupOrdersListener = () => {
    try {
      console.log('🎣 Setting up orders realtime listener for store:', storeId);

      const channel = supabase.channel(`realtime:orders:${storeId}`, {
        config: {
          broadcast: { self: true },
        },
      });

      // ✅ إضافة مستمع INSERT
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('✅ Order INSERT:', payload.new.id);
          callback({
            type: 'orders',
            event: 'INSERT',
            data: payload.new,
          });
        }
      );

      // ✅ إضافة مستمع UPDATE
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('✅ Order UPDATE:', payload.new.id);
          callback({
            type: 'orders',
            event: 'UPDATE',
            data: payload.new,
          });
        }
      );

      // ✅ إضافة مستمع DELETE
      channel.on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('✅ Order DELETE:', payload.old.id);
          callback({
            type: 'orders',
            event: 'DELETE',
            data: payload.old,
          });
        }
      );

      // ✅ استدعاء subscribe في النهاية
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('🔌 Realtime SUBSCRIBED to orders:', storeId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Orders channel error');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Orders realtime timed out');
        }
      });

      return () => {
        channel.unsubscribe();
        console.log('🔌 Orders listener unsubscribed');
      };
    } catch (error) {
      console.error('❌ Error setting up orders channel:', error.message);
      return () => {};
    }
  };

  // ✅ تشغيل كل الـ listeners
  const unsubscribeProducts = setupProductsListener();
  const unsubscribeOrders = setupOrdersListener();

  // ✅ إرجع دالة لإلغاء جميع الـ listeners
  return () => {
    unsubscribeProducts();
    unsubscribeOrders();
  };
};

/**
 * ✅ مستمع جدول عام مع قناة مشتركة وفريدة لكل (table, store).
 * يمنع إنشاء قنوات متكررة أثناء تبديل الشاشات/إعادة التركيب، ويضمن
 * إضافة جميع postgres_changes callbacks قبل subscribe().
 */
const tableSubscriptions = new Map();

export const setupTableListener = (tableName, storeId, callback) => {
  if (!tableName || !storeId || typeof callback !== 'function') return () => {};

  const key = `${tableName}:${storeId}`;
  let entry = tableSubscriptions.get(key);

  if (!entry) {
    const callbacks = new Set();
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(`kilix-table:${tableName}:${storeId}:${suffix}`);

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName, filter: `store_id=eq.${storeId}` },
      (payload) => {
        // Coalesce rapid bursts (for example an order update plus trigger-driven
        // changes) into one callback cycle. This reduces duplicate full refreshes
        // while preserving the latest event payload for existing consumers.
        entry.pendingPayload = payload;
        if (entry.dispatchTimer) return;
        entry.dispatchTimer = setTimeout(() => {
          entry.dispatchTimer = null;
          const pending = entry.pendingPayload;
          entry.pendingPayload = null;
          callbacks.forEach((listener) => {
            try {
              listener(pending);
            } catch (error) {
              if (__DEV__) console.error(`[Realtime] ${tableName} callback error:`, error);
            }
          });
        }, 150);
      }
    );

    entry = { channel, callbacks, subscriberCount: 0, removed: false, pendingPayload: null, dispatchTimer: null };
    tableSubscriptions.set(key, entry);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (__DEV__) console.log(`🔌 Realtime SUBSCRIBED to ${tableName}:`, storeId);
      } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !entry.removed) {
        if (__DEV__) console.error(`❌ ${tableName} realtime channel error:`, storeId, status);
      }
    });
  }

  entry.callbacks.add(callback);
  entry.subscriberCount += 1;

  let active = true;
  return () => {
    if (!active) return;
    active = false;

    const current = tableSubscriptions.get(key);
    if (!current) return;

    current.callbacks.delete(callback);
    current.subscriberCount = Math.max(0, current.subscriberCount - 1);

    if (current.subscriberCount === 0) {
      current.removed = true;
      if (current.dispatchTimer) {
        clearTimeout(current.dispatchTimer);
        current.dispatchTimer = null;
      }
      current.pendingPayload = null;
      tableSubscriptions.delete(key);
      void supabase.removeChannel(current.channel);
    }
  };
};

/**
 * ✅ دالة مساعدة لإرسال بث (Broadcast)
 */
export const sendBroadcastMessage = async (channelName, message) => {
  try {
    const channel = supabase.channel(channelName);

    await channel.send({
      type: 'broadcast',
      event: 'message',
      payload: message,
    });

    console.log('✅ Broadcast message sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending broadcast:', error);
    return { success: false, error: error.message };
  }
};

export const subscribeToProductReviews = (productId, callback) => {
  if (!productId || typeof callback !== 'function') return () => {};

  // Supabase channels are identified by their topic. Reusing the exact same
  // topic while a previous channel is still subscribed can cause the SDK to
  // reject callback registration during rapid React remounts/navigation.
  // Give every product-review subscription its own topic and register the
  // postgres_changes callback before subscribe().
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase
    .channel(`realtime:product-reviews:${productId}:${uniqueSuffix}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'order_reviews',
        filter: `product_id=eq.${productId}`,
      },
      callback
    );

  channel.subscribe((status) => {
    if (__DEV__ && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
      console.warn('[Realtime] product reviews channel status:', status, productId);
    }
  });

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    void supabase.removeChannel(channel);
  };
};

// Keep exactly one postgres_changes callback per store channel.
// Multiple React effects can subscribe to the same store at once; callbacks are
// dispatched from one listener so we never call `.on()` after `.subscribe()`.
const storeProductSubscriptions = new Map();

export const subscribeToStoreProducts = (storeId, callback) => {
  if (!storeId || typeof callback !== 'function') return () => {};

  let entry = storeProductSubscriptions.get(storeId);

  if (!entry) {
    const callbacks = new Set();
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(`kilix-store-products:${storeId}:${uniqueSuffix}`);

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products', filter: `store_id=eq.${storeId}` },
      (payload) => {
        callbacks.forEach((listener) => {
          try {
            listener(payload);
          } catch (error) {
            if (__DEV__) console.error('[Realtime] store products callback error:', error);
          }
        });
      }
    );

    entry = { channel, callbacks, subscriberCount: 0 };
    storeProductSubscriptions.set(storeId, entry);

    channel.subscribe((status) => {
      if (__DEV__ && status === 'CHANNEL_ERROR') {
        console.error('[Realtime] store products channel error:', storeId);
      }
    });
  }

  entry.callbacks.add(callback);
  entry.subscriberCount += 1;

  let active = true;
  return () => {
    if (!active) return;
    active = false;

    const current = storeProductSubscriptions.get(storeId);
    if (!current) return;

    current.callbacks.delete(callback);
    current.subscriberCount = Math.max(0, current.subscriberCount - 1);

    if (current.subscriberCount === 0) {
      storeProductSubscriptions.delete(storeId);
      void supabase.removeChannel(current.channel);
    }
  };
};

export const subscribeToProductOrders = (productId, callback) => {
  if (!productId || typeof callback !== 'function') return () => {};

  // Never reuse the same topic for a product-order subscription. React Navigation
  // can mount/unmount ProductDetailScreen rapidly, and Supabase rejects adding
  // postgres_changes handlers to a channel that has already reached subscribe().
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase
    .channel(`realtime:product-orders:${productId}:${uniqueSuffix}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `product_id=eq.${productId}` },
      callback
    );

  channel.subscribe((status) => {
    if (__DEV__ && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
      console.warn('[Realtime] product orders channel status:', status, productId);
    }
  });

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    void supabase.removeChannel(channel);
  };
};


export default {
  useRealtimeListener,
  setupTableListener,
  sendBroadcastMessage,
  subscribeToProductReviews,
  subscribeToStoreProducts,
  subscribeToProductOrders,
};