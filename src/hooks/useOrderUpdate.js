import { showLocalizedAlert } from '../context/LanguageContext';
/**
 * ============================================================================
 * useOrderUpdate.js - Hook تحديث الطلبات السريع
 * ============================================================================
 * 
 * المشكلة الأولى: تأخر تحديث حالة الطلب
 * الحل: 
 *   1. تحديث محلي فوري (Optimistic Update)
 *   2. إرسال التحديث للخادم بالتوازي
 *   3. معالجة الأخطاء بشكل آني
 *   4. تجنب تضارب الـ Real-time subscriptions
 */

import { useCallback, useRef } from 'react';
import {} from 'react-native';
import { merchantUpdateOrderStatus } from '../services/orderService';

const ORDER_UPDATE_QUEUE = [];
let isProcessingQueue = false;

/**
 * معالج قائمة انتظار التحديثات
 * يضمن عدم حدوث تعارضات في التحديثات المتتالية
 */
const processUpdateQueue = async () => {
  if (isProcessingQueue || ORDER_UPDATE_QUEUE.length === 0) return;
  
  isProcessingQueue = true;
  
  while (ORDER_UPDATE_QUEUE.length > 0) {
    const updateTask = ORDER_UPDATE_QUEUE.shift();
    try {
      await updateTask();
      // تأخير بسيط بين التحديثات لتجنب الازدحام
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      if (__DEV__) console.error('[processUpdateQueue] error:', error);
    }
  }
  
  isProcessingQueue = false;
};

export function useOrderUpdate() {
  const ordersCacheRef = useRef({});
  const updateTimeoutRef = useRef(null);

  /**
   * تحديث حالة الطلب مع التحديث المحلي الفوري
   * 
   * @param {string} orderId - معرف الطلب
   * @param {string} newStatus - الحالة الجديدة
   * @param {string} statusLabel - تسمية الحالة بالعربية
   * @param {Function} onLocalUpdate - callback لتحديث الـ UI محلياً
   * @returns {Promise<boolean>}
   */
  const updateOrderStatusOptimistic = useCallback(
    async (orderId, newStatus, statusLabel, onLocalUpdate) => {
      if (!orderId || !newStatus) {
        if (__DEV__) console.warn('[useOrderUpdate] Missing orderId or newStatus');
        return false;
      }

      // 🔴 الخطوة 1: تحديث محلي فوري في الـ Cache
      ordersCacheRef.current[orderId] = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      // تحديث الـ UI فوراً
      if (onLocalUpdate) {
        onLocalUpdate(orderId, newStatus);
      }

      // إظهار تنبيه النجاح فوراً
      showLocalizedAlert('✓ جارٍ التحديث', `تم تحديث الطلبية إلى: ${statusLabel}`, [
        { text: 'حسناً', style: 'default' },
      ]);

      // 🟡 الخطوة 2: إضافة التحديث إلى قائمة الانتظار
      const updateTask = async () => {
        try {
          const updated = await merchantUpdateOrderStatus(orderId, newStatus);

          if (__DEV__) {
            console.log(`[useOrderUpdate] Order ${orderId} updated to ${updated?.status || newStatus}`);
          }

          return true;
        } catch (error) {
          if (__DEV__) console.error('[updateOrderStatusOptimistic] DB error:', error);
          
          // استرجاع التغيير المحلي في حالة الفشل
          delete ordersCacheRef.current[orderId];
          
          showLocalizedAlert(
            '❌ خطأ',
            'تعذّر تحديث حالة الطلبية. يرجى المحاولة مرة أخرى.',
            [{ text: 'حسناً', style: 'destructive' }]
          );
          
          return false;
        }
      };

      ORDER_UPDATE_QUEUE.push(updateTask);
      
      // 🟢 الخطوة 3: معالجة قائمة الانتظار
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      updateTimeoutRef.current = setTimeout(() => {
        processUpdateQueue();
      }, 100);

      return true;
    },
    []
  );

  /**
   * تحديث الطلب فقط. رسالة تأكيد الشحن ينشئها Trigger قاعدة البيانات
   * بعد نجاح الـRPC، لذلك لا يوجد مسار ثانٍ لإرسال رسالة مكررة.
   */
  const updateOrderWithMessage = useCallback(
    async (orderId, newStatus, statusLabel, _customerId, _merchantId, _storeId, _storeName, _messageText, onLocalUpdate) =>
      updateOrderStatusOptimistic(orderId, newStatus, statusLabel, onLocalUpdate),
    [updateOrderStatusOptimistic]
  );

  /**
   * جلب حالة الطلب الحالية من الـ Cache أو الخادم
   */
  const getOrderStatus = useCallback((orderId) => {
    return ordersCacheRef.current[orderId]?.status || null;
  }, []);

  /**
   * مسح الـ Cache (استخدم عند تسجيل الخروج أو تحديث البيانات)
   */
  const clearCache = useCallback(() => {
    ordersCacheRef.current = {};
  }, []);

  return {
    updateOrderStatusOptimistic,
    updateOrderWithMessage,
    getOrderStatus,
    clearCache,
  };
}
