import { supabase } from '../config/supabaseConfig';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

export const createStoreService = async (ownerId, storeData = {}) => {
  if (!isUuid(ownerId)) return { success: false, message: 'معرف المستخدم غير صحيح' };
  const { data: existing } = await supabase.from('stores').select('id,store_code').eq('owner_id', ownerId).maybeSingle();
  if (existing) return { success: true, storeId: existing.id, storeCode: existing.store_code, existing: true, data: existing };

  const { data, error } = await supabase.from('stores').insert({
    owner_id: ownerId,
    store_name: String(storeData.storeName || '').trim(),
    description: String(storeData.description || '').trim(),
    products_type: String(storeData.productsType || '').trim(),
    merchant_type: storeData.merchantType === 'factory' ? 'factory' : 'wholesaler',
    logo_url: storeData.logoUrl || null,
  }).select('*').single();
  if (error) return { success: false, message: error.message };
  return { success: true, storeId: data.id, storeCode: data.store_code, data };
};

export const getStoreDataService = async (identifier) => {
  if (!identifier) return { success: false, message: 'معرف المتجر مفقود' };
  let query = supabase.from('stores').select('*');
  query = isUuid(identifier) ? query.eq('id', identifier) : query.eq('store_code', identifier);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return { success: false, message: 'المتجر غير موجود' };
  return { success: true, data };
};

export const openStoreChat = async (storeId) => {
  if (!storeId) throw new Error('معرف المتجر مفقود');
  const { data, error } = await supabase.rpc('open_store_chat', { p_store_id: storeId });
  if (error) throw error;
  return data;
};

export const getStoreByOwner = async (ownerId) => {
  if (!ownerId) return null;
  const { data, error } = await supabase.from('stores').select('*').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data || null;
};

export const followStoreService = async (storeId) => {
  if (!storeId) return { success: false, message: 'معرف المتجر مفقود' };
  const { error } = await supabase.rpc('follow_store', { p_store_id: storeId });
  return error ? { success: false, message: error.message } : { success: true };
};

export const unfollowStoreService = async (storeId) => {
  if (!storeId) return { success: false, message: 'معرف المتجر مفقود' };
  const { error } = await supabase.rpc('unfollow_store', { p_store_id: storeId });
  return error ? { success: false, message: error.message } : { success: true };
};

export const isFollowingStore = async (storeId, userId) => {
  if (!storeId || !userId) return false;
  const { data, error } = await supabase.from('store_followers').select('id').eq('store_id', storeId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return !!data;
};

export const getStoreProducts = async (storeId, { limit = 40, offset = 0 } = {}) => {
  if (!storeId) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);
  if (error) throw error;
  return data || [];
};

export const getStoreProductCount = async (storeId) => {
  if (!storeId) return 0;
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('is_active', true);
  if (error) throw error;
  return Number(count) || 0;
};

export const updateStoreService = async (storeId, updates = {}) => {
  const allowed = ['store_name','description','products_type','merchant_type','logo_url'];
  const payload = Object.fromEntries(Object.entries(updates).filter(([key]) => allowed.includes(key)));
  const { data, error } = await supabase.from('stores').update(payload).eq('id', storeId).select('*').single();
  if (error) throw error;
  return { success: true, data };
};

export const deleteStoreService = async (storeId) => {
  const { error } = await supabase.from('stores').delete().eq('id', storeId);
  return error ? { success: false, message: error.message } : { success: true };
};
