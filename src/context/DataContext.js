import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from '../constants/categories';
import { useAuth } from './AuthContext';
import { getMyOrders, merchantUpdateOrderStatus, confirmOrderReceived } from '../services/orderService';
import { getProductReviews, getProductRating, submitOrderReview } from '../services/reviewService';
import { getUserChats, sendMessage as sendChatMessage, markChatAsRead } from '../services/chatService';
import { supabase } from '../config/supabaseConfig';
import { getNotifications, getUnreadNotificationsCount as getUnreadNotificationsCountService, markNotificationRead as markNotificationReadService, markAllNotificationsRead as markAllNotificationsReadService, getReviewCoupon } from '../services/notificationService';
import { getProducts } from '../services/productService';

const DataContext = createContext(null);

const normalizeNotification = (row) => ({
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

export function DataProvider({ children }) {
  const { user } = useAuth();
  const currentUid = user?.auth_id || null;
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [products, setProducts] = useState([]);
  const [productReviews, setProductReviews] = useState({});
  const [productRatings, setProductRatings] = useState({});
  const [categories] = useState(CATEGORIES);
  const [coupons] = useState([]);
  const [loading, setLoading] = useState({ orders:false, ordersMore:false, notifications:false, notificationsMore:false, conversations:false, products:false, reviews:false });
  const [errors, setErrors] = useState({ orders:null, notifications:null, conversations:null, products:null, reviews:null });
  const orderRefreshTimerRef = React.useRef(null);
  const ordersOffsetRef = React.useRef(0);
  const notificationsOffsetRef = React.useRef(0);
  const conversationsOffsetRef = React.useRef(0);
  const ORDERS_PAGE_SIZE = 50;
  const NOTIFICATIONS_PAGE_SIZE = 50;
  const CONVERSATIONS_PAGE_SIZE = 50;

  const loadOrders = useCallback(async () => {
    if (!currentUid) { setOrders([]); ordersOffsetRef.current = 0; return; }
    setLoading((s) => ({...s, orders:true}));
    try {
      const page = await getMyOrders(currentUid, { limit: ORDERS_PAGE_SIZE, offset: 0 });
      ordersOffsetRef.current = page.length;
      setOrders(page);
    } catch (err) { setErrors((s)=>({...s,orders:err.message})); setOrders([]); }
    finally { setLoading((s)=>({...s,orders:false})); }
  }, [currentUid]);

  const loadMoreOrders = useCallback(async () => {
    if (!currentUid || loading.orders || loading.ordersMore) return;
    setLoading((s) => ({...s, ordersMore:true}));
    try {
      const page = await getMyOrders(currentUid, { limit: ORDERS_PAGE_SIZE, offset: ordersOffsetRef.current });
      ordersOffsetRef.current += page.length;
      setOrders((prev) => [...prev, ...page.filter((item) => !prev.some((x) => x.id === item.id))]);
    } catch (err) { setErrors((s)=>({...s,orders:err.message})); }
    finally { setLoading((s)=>({...s,ordersMore:false})); }
  }, [currentUid, loading.orders, loading.ordersMore]);

  const loadNotifications = useCallback(async () => {
    if (!currentUid) { setNotifications([]); setUnreadNotificationsCount(0); notificationsOffsetRef.current = 0; return; }
    setLoading((s) => ({...s,notifications:true}));
    try {
      const [page, unreadCount] = await Promise.all([
        getNotifications(currentUid, { limit: NOTIFICATIONS_PAGE_SIZE, offset: 0 }),
        getUnreadNotificationsCountService(currentUid),
      ]);
      notificationsOffsetRef.current = page.length;
      setNotifications(page);
      setUnreadNotificationsCount(Number(unreadCount) || 0);
    } catch (err) { setErrors((s)=>({...s,notifications:err.message})); setNotifications([]); }
    finally { setLoading((s)=>({...s,notifications:false})); }
  }, [currentUid]);

  const loadMoreNotifications = useCallback(async () => {
    if (!currentUid || loading.notifications || loading.notificationsMore) return;
    setLoading((s) => ({...s, notificationsMore:true}));
    try {
      const page = await getNotifications(currentUid, { limit: NOTIFICATIONS_PAGE_SIZE, offset: notificationsOffsetRef.current });
      notificationsOffsetRef.current += page.length;
      setNotifications((prev) => [...prev, ...page.filter((item) => !prev.some((x) => x.id === item.id))]);
    } catch (err) { setErrors((s)=>({...s,notifications:err.message})); }
    finally { setLoading((s)=>({...s,notificationsMore:false})); }
  }, [currentUid, loading.notifications, loading.notificationsMore]);

  const loadConversations = useCallback(async () => {
    if (!currentUid) { setConversations([]); conversationsOffsetRef.current = 0; return; }
    setLoading((s)=>({...s,conversations:true}));
    try {
      const page = await getUserChats(currentUid, { limit: CONVERSATIONS_PAGE_SIZE, offset: 0 });
      conversationsOffsetRef.current = page.length;
      setConversations(page);
    }
    catch (err) { setErrors((s)=>({...s,conversations:err.message})); setConversations([]); }
    finally { setLoading((s)=>({...s,conversations:false})); }
  }, [currentUid]);

  const loadMoreConversations = useCallback(async () => {
    if (!currentUid || loading.conversations) return;
    try {
      const page = await getUserChats(currentUid, { limit: CONVERSATIONS_PAGE_SIZE, offset: conversationsOffsetRef.current });
      conversationsOffsetRef.current += page.length;
      setConversations((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...page.filter((item) => !seen.has(item.id))];
      });
    } catch (err) {
      setErrors((s)=>({...s,conversations:err.message}));
    }
  }, [currentUid, loading.conversations]);

  const loadProducts = useCallback(async () => {
    setLoading((s)=>({...s,products:true}));
    try {
      setProducts(await getProducts({ includeInactive: false, limit: 50, offset: 0 }));
    } catch (err) { setErrors((s)=>({...s,products:err.message})); setProducts([]); }
    finally { setLoading((s)=>({...s,products:false})); }
  }, []);

  const loadProductReviews = useCallback(async (productId) => {
    if (!productId) return;
    setLoading((s)=>({...s,reviews:true}));
    try {
      const [reviews, rating] = await Promise.all([getProductReviews(productId,4), getProductRating(productId)]);
      setProductReviews((s)=>({...s,[productId]:reviews}));
      setProductRatings((s)=>({...s,[productId]:rating}));
    } catch (err) { setErrors((s)=>({...s,reviews:err.message})); }
    finally { setLoading((s)=>({...s,reviews:false})); }
  }, []);

  const loadMultipleProductReviews = useCallback(async (ids=[]) => { await Promise.all(ids.map(loadProductReviews)); }, [loadProductReviews]);
  const getProductReviewsCached = useCallback((id)=>productReviews[id] || [],[productReviews]);
  const getProductRatingCached = useCallback((id)=>productRatings[id] || {average:0,count:0},[productRatings]);

  const updateOrderStatus = useCallback(async (orderId, status) => {
    const updated = await merchantUpdateOrderStatus(orderId, status);
    setOrders((prev)=>prev.map((o)=>o.id===orderId?updated:o));
    return updated;
  }, []);

  const confirmReceipt = useCallback(async (orderId) => {
    const updated = await confirmOrderReceived(orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? updated : o));
    return updated;
  }, []);

  const submitReview = useCallback(async (orderId, ratingOrPayload, comment, productId) => {
    const payload = (ratingOrPayload && typeof ratingOrPayload === 'object')
      ? { orderId, rating: ratingOrPayload.rating, comment: ratingOrPayload.comment }
      : { orderId, rating: ratingOrPayload, comment };
    const result = await submitOrderReview(payload);
    if (result.success && productId) await loadProductReviews(productId);
    if (result.success) {
      await loadOrders();
      const coupon = await getReviewCoupon(result.data?.id);
      return { ...result, coupon };
    }
    return result;
  }, [loadOrders, loadProductReviews]);

  const sendMessage = useCallback(async (conversationId, text) => {
    if (!currentUid) return {success:false,error:'غير مسجل الدخول'};
    return sendChatMessage(conversationId, currentUid, text);
  }, [currentUid]);

  const markNotificationRead = useCallback(async (id) => {
    const target = notifications.find((notification) => notification.id === id);
    await markNotificationReadService(id, currentUid);
    setNotifications((prev)=>prev.map((n)=>n.id===id?{...n,read:true}:n));
    if (target && !target.read) {
      setUnreadNotificationsCount((count)=>Math.max(0, count - 1));
    }
  }, [currentUid, notifications]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!currentUid) return;
    await markAllNotificationsReadService(currentUid);
    setNotifications((prev)=>prev.map((n)=>({...n,read:true})));
    setUnreadNotificationsCount(0);
  }, [currentUid]);

  useEffect(()=>{
    if (!currentUid) { setOrders([]); setNotifications([]); setUnreadNotificationsCount(0); setConversations([]); conversationsOffsetRef.current = 0; return; }
    void loadOrders(); void loadNotifications(); void loadConversations();
    const notificationChannel = supabase.channel(`notifications:${currentUid}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${currentUid}`},(payload)=>{
      const incoming = normalizeNotification(payload.new);
      setNotifications((prev)=>[incoming,...prev.filter((n)=>n.id!==incoming.id)]);
      if (!incoming.read) setUnreadNotificationsCount((count)=>count + 1);
    }).subscribe();
    const scheduleOrderRefresh = () => {
      if (orderRefreshTimerRef.current) return;
      // A checkout/status change can emit several Postgres events in a short
      // burst. Coalesce them into one read to avoid a refresh storm per user.
      orderRefreshTimerRef.current = setTimeout(() => {
        orderRefreshTimerRef.current = null;
        void loadOrders();
      }, 250);
    };
    const orderChannel = supabase.channel(`orders:${currentUid}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:`user_id=eq.${currentUid}`},scheduleOrderRefresh)
      .subscribe();
    return ()=>{
      if (orderRefreshTimerRef.current) {
        clearTimeout(orderRefreshTimerRef.current);
        orderRefreshTimerRef.current = null;
      }
      void supabase.removeChannel(notificationChannel);
      void supabase.removeChannel(orderChannel);
    };
  }, [currentUid, loadConversations, loadNotifications, loadOrders]);

  useEffect(()=>{ void loadProducts(); },[loadProducts]);

  const value = useMemo(()=>({
    orders,notifications,conversations,categories,products,coupons,loading,errors,
    loadOrders,loadMoreOrders,loadNotifications,loadMoreNotifications,markNotificationRead,markAllNotificationsRead,unreadNotificationsCount,
    loadProducts,loadConversations,loadMoreConversations,updateOrderStatus,confirmReceipt,sendMessage,submitOrderReview:submitReview,
    productReviews,productRatings,loadProductReviews,loadMultipleProductReviews,getProductReviews:getProductReviewsCached,getProductRating:getProductRatingCached,
    markChatAsRead: async (chatId)=>currentUid?markChatAsRead(chatId,currentUid):null,
  }),[categories,conversations,currentUid,errors,loading,loadConversations,loadMoreConversations,loadNotifications,loadOrders,loadMoreOrders,loadMoreNotifications,loadProducts,markAllNotificationsRead,markNotificationRead,notifications,orders,productRatings,productReviews,products,sendMessage,submitReview,unreadNotificationsCount,updateOrderStatus,coupons,getProductReviewsCached,getProductRatingCached,loadProductReviews,loadMultipleProductReviews,confirmReceipt]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(){ const ctx=useContext(DataContext); if(!ctx) throw new Error('useData must be used within DataProvider'); return ctx; }
export default DataContext;
