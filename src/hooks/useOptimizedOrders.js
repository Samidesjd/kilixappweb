/**
 * ============================================================================
 * useOptimizedOrders.js
 * ============================================================================
 * 
 * Hook مخصص لإدارة الطلبيات مع:
 * 1. تحديث محلي فوري (Optimistic Update)
 * 2. Realtime المحسّن بدون تداخل
 * 3. معالجة الأخطاء الذكية
 * 4. تنظيف الموارد تلقائياً
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  updateOrderStatusOptimized,
  updateOrderStatusWithDebounce,
  subscribeToBuyerOrders,
  subscribeToSellerOrders,
} from '../services/optimizedOrderService';

/**
 * Hook لإدارة طلبيات المشتري
 * 
 * @param {string} buyerId - معرف المشتري
 * @param {Array} initialOrders - الطلبيات الأولية
 * @returns {Object} - orders, updateStatus, loading, error
 */
export function useBuyerOrders(buyerId, initialOrders = []) {
  const [orders, setOrders] = useState(initialOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);

  // تحديث حالة الطلب مع تحديث محلي فوري
  const updateOrderStatus = useCallback(
    async (orderId, newStatus, options = {}) => {
      setLoading(true);
      setError(null);

      try {
        const result = await updateOrderStatusOptimized(
          orderId,
          newStatus,
          options,
          (updatedOrder) => {
            // تحديث محلي فوري
            setOrders((prev) =>
              prev.map((o) =>
                o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o
              )
            );
          }
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return result;
      } catch (err) {
        setError(err.message);
        return {
          success: false,
          error: err.message,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // تحديث حالة الطلب مع Debouncing
  const updateOrderStatusDebounced = useCallback(
    (orderId, newStatus, options = {}, debounceDelay = 500) => {
      updateOrderStatusWithDebounce(
        orderId,
        newStatus,
        options,
        (updatedOrder) => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o
            )
          );
        },
        debounceDelay
      );
    },
    []
  );

  // الاشتراك في تحديثات الطلبيات
  useEffect(() => {
    if (!buyerId) return;

    const handleOrderUpdate = (payload) => {
      const { eventType, new: newOrder, old: oldOrder } = payload;

      if (eventType === 'INSERT') {
        setOrders((prev) => [newOrder, ...prev]);
      } else if (eventType === 'UPDATE') {
        setOrders((prev) =>
          prev.map((o) => (o.id === newOrder.id ? newOrder : o))
        );
      } else if (eventType === 'DELETE') {
        setOrders((prev) => prev.filter((o) => o.id !== oldOrder.id));
      }
    };

    unsubscribeRef.current = subscribeToBuyerOrders(buyerId, handleOrderUpdate);

    return () => {
      if (typeof unsubscribeRef.current === 'function') {
        unsubscribeRef.current();
      }
    };
  }, [buyerId]);

  return {
    orders,
    setOrders,
    updateOrderStatus,
    updateOrderStatusDebounced,
    loading,
    error,
    setError,
  };
}

/**
 * Hook لإدارة طلبيات البائع
 * 
 * @param {string} storeId - معرف المتجر
 * @param {Array} initialOrders - الطلبيات الأولية
 * @returns {Object} - orders, updateStatus, loading, error
 */
export function useSellerOrders(storeId, initialOrders = []) {
  const [orders, setOrders] = useState(initialOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);

  // تحديث حالة الطلب مع تحديث محلي فوري
  const updateOrderStatus = useCallback(
    async (orderId, newStatus, options = {}) => {
      setLoading(true);
      setError(null);

      try {
        const result = await updateOrderStatusOptimized(
          orderId,
          newStatus,
          options,
          (updatedOrder) => {
            // تحديث محلي فوري
            setOrders((prev) =>
              prev.map((o) =>
                o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o
              )
            );
          }
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return result;
      } catch (err) {
        setError(err.message);
        return {
          success: false,
          error: err.message,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // تحديث حالة الطلب مع Debouncing
  const updateOrderStatusDebounced = useCallback(
    (orderId, newStatus, options = {}, debounceDelay = 500) => {
      updateOrderStatusWithDebounce(
        orderId,
        newStatus,
        options,
        (updatedOrder) => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o
            )
          );
        },
        debounceDelay
      );
    },
    []
  );

  // الاشتراك في تحديثات الطلبيات
  useEffect(() => {
    if (!storeId) return;

    const handleOrderUpdate = (payload) => {
      const { eventType, new: newOrder, old: oldOrder } = payload;

      if (eventType === 'INSERT') {
        setOrders((prev) => [newOrder, ...prev]);
      } else if (eventType === 'UPDATE') {
        setOrders((prev) =>
          prev.map((o) => (o.id === newOrder.id ? newOrder : o))
        );
      } else if (eventType === 'DELETE') {
        setOrders((prev) => prev.filter((o) => o.id !== oldOrder.id));
      }
    };

    unsubscribeRef.current = subscribeToSellerOrders(storeId, handleOrderUpdate);

    return () => {
      if (typeof unsubscribeRef.current === 'function') {
        unsubscribeRef.current();
      }
    };
  }, [storeId]);

  return {
    orders,
    setOrders,
    updateOrderStatus,
    updateOrderStatusDebounced,
    loading,
    error,
    setError,
  };
}

export default {
  useBuyerOrders,
  useSellerOrders,
};
