import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../config/supabaseConfig';

/**
 * Convert Supabase product record to the format expected by ProductCard
 * @param {object} record - Product record from Supabase
 * @returns {object} Normalized product object
 */
export function mapSupabaseProductRecord(record) {
  return {
    id: record.id,
    title: record.title || '',
    price: typeof record.price === 'number' ? record.price : Number(record.price) || 0,
    image: Array.isArray(record.images) && record.images.length > 0 ? record.images[0] : null,
    images: record.images || [],
    currency: 'دج',
    category: record.category || 'all',
    description: record.description || '',
    colors: Array.isArray(record.colors) ? record.colors : [],
    storeId: record.store_id || null,
    storeName: record.stores?.store_name || null,
    embedding: record.embedding || null,
    image_embedding_version: record.image_embedding_version || null,
    imageEmbeddingVersion: record.image_embedding_version || null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

/**
 * Fetch products from Supabase and keep the existing public hook API.
 *
 * Important scalability behavior:
 * - The initial query remains unchanged so existing screens keep receiving the
 *   complete product shape they currently expect.
 * - Realtime product events are applied locally instead of re-reading the
 *   entire products table after every INSERT/UPDATE/DELETE.
 * - INSERT only fetches the related store name, because realtime payloads do
 *   not include nested `stores` relations.
 * - The subscription is cleaned up on unmount.
 */
export function useSupabaseProducts() {
  const PAGE_SIZE = 40;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const subscriptionRef = useRef(null);

  const fetchPage = useCallback(async (offset, replace = false) => {
    const { data, error } = await supabase
      .from('products')
      .select('*, stores(store_name)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const mapped = (data || []).map(mapSupabaseProductRecord);
    offsetRef.current = offset + mapped.length;
    setHasMore(mapped.length === PAGE_SIZE);
    setProducts((prev) => {
      if (replace) return mapped;
      const seen = new Set(prev.map((item) => item.id));
      return [...prev, ...mapped.filter((item) => !seen.has(item.id))];
    });
    return mapped;
  }, []);

  const refreshProducts = useCallback(async () => {
    setLoading(true);
    try {
      await fetchPage(0, true);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMoreProducts = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try { await fetchPage(offsetRef.current, false); }
    finally { setLoadingMore(false); }
  }, [fetchPage, hasMore, loading, loadingMore]);

  useEffect(() => {
    let mounted = true;
    const setupSubscription = async () => {
      try {
        await fetchPage(0, true);
        if (!mounted) return;

        const applyRealtimeProductChange = async (payload) => {
          if (!mounted) return;
          const eventType = payload?.eventType;
          const row = payload?.new;
          const oldRow = payload?.old;
          if (eventType === 'DELETE') {
            if (!oldRow?.id) return;
            setProducts((prev) => prev.filter((product) => product.id !== oldRow.id));
            return;
          }
          if (!row?.id) return;
          if (eventType === 'INSERT') {
            if (row.is_active === false) return;
            let storeName = null;
            if (row.store_id) {
              const { data: store, error: storeError } = await supabase.from('stores').select('store_name').eq('id', row.store_id).maybeSingle();
              if (!storeError) storeName = store?.store_name || null;
            }
            if (!mounted) return;
            const mapped = mapSupabaseProductRecord({ ...row, stores: { store_name: storeName } });
            setProducts((prev) => prev.some((product) => product.id === mapped.id) ? prev : [mapped, ...prev]);
            return;
          }
          if (eventType === 'UPDATE') {
            if (row.is_active === false) {
              setProducts((prev) => prev.filter((product) => product.id !== row.id));
              return;
            }
            setProducts((prev) => {
              const existing = prev.find((product) => product.id === row.id);
              if (!existing) return [mapSupabaseProductRecord(row), ...prev];
              const mapped = mapSupabaseProductRecord({ ...row, stores: { store_name: existing.storeName } });
              return prev.map((product) => product.id === mapped.id ? mapped : product);
            });
          }
        };

        const channel = supabase.channel(`kilix-products:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => { void applyRealtimeProductChange(payload); });
        subscriptionRef.current = channel;
        channel.subscribe((status) => {
          if (__DEV__ && (status === 'SUBSCRIBED' || status === 'CLOSED')) console.log(`[useSupabaseProducts] Real-time ${status.toLowerCase()}`);
        });
      } catch (error) {
        if (__DEV__) console.error('[useSupabaseProducts] setup error:', error);
        if (mounted) setLoading(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void setupSubscription();
    return () => {
      mounted = false;
      const channel = subscriptionRef.current;
      subscriptionRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fetchPage]);

  return { products, loading, loadingMore, hasMore, loadMoreProducts, refreshProducts };
}

/**
 * Backward-compatible alias retained for existing screens/imports.
 */
export const useFirestoreProducts = useSupabaseProducts;
