import { supabase } from '../config/supabaseConfig';

export const PRODUCT_CATEGORIES = ['electronics','clothing','home','construction','other'];
export const PRODUCT_TEMPLATES = ['clothing','computer','phone','watch','home','women','electronics','fashion_accessories','jewelry','clothing_shoes','toys_hobbies','security_protection','mothers_kids','beauty_health','cars'];


async function refreshProductEmbedding(productId, imageUrl, productContext = '', allImages = []) {
  if (!productId || !imageUrl) return { success: false, skipped: true };
  // Keep the two indexing systems independent. The dedicated multimodal index is the primary
  // search path, so it must not wait for the slower legacy semantic embedding. Both operations
  // stay non-blocking and neither can prevent product creation/update from succeeding.
  const urls = Array.from(new Set((allImages?.length ? allImages : [imageUrl]).filter(Boolean))).slice(0, 6);
  const visualPromise = Promise.all(urls.map(async (url, imageIndex) => {
    // Generate the vector through the protected Edge Function, then persist it through
    // a narrowly-scoped owner-checked RPC. This avoids relying on Edge Function-side
    // service-role authorization headers for persistence and makes failures explicit.
    const visual = await supabase.functions.invoke('visual-embedding', { body: { imageUrl: url } });
    if (visual.error || visual.data?.success === false) {
      throw new Error(visual.data?.error || visual.error?.message || 'visual embedding failed');
    }
    const embedding = Array.isArray(visual.data?.embedding) ? visual.data.embedding : null;
    if (!embedding || embedding.length !== 768) throw new Error('invalid visual embedding');
    const { error: saveError } = await supabase.rpc('save_product_visual_embedding', {
      p_product_id: productId,
      p_image_url: url,
      p_image_index: imageIndex,
      p_embedding: embedding,
      p_model_version: 'gemini-embedding-2-768',
    });
    if (saveError) throw saveError;
  }));

  const semanticPromise = supabase.functions.invoke('embed-image', {
    body: { imageUrl, productId, queryText: productContext?.trim() || undefined },
  }).then(({ data, error }) => {
    if (error) {
      if (__DEV__) console.warn('[productService] embedding update failed:', error.message);
      return { success: false, message: error.message };
    }
    if (data?.error) {
      if (__DEV__) console.warn('[productService] embedding update failed:', data.error);
      return { success: false, message: data.error };
    }
    return { success: true, data };
  });

  // Indexing is deliberately detached from product writes. The database row is already
  // saved, so AI latency or rate limits must never make publishing/editing feel blocked.
  void visualPromise.catch((error) => {
    if (__DEV__) console.warn('[productService] visual indexing batch failed:', error?.message || error);
  });
  void semanticPromise.catch((error) => {
    if (__DEV__) console.warn('[productService] semantic indexing failed:', error?.message || error);
  });

  return { success: true, indexingStarted: true };
}

const cleanProduct = (data = {}) => ({
  title: String(data.title || '').trim(),
  price: Number(data.price),
  description: String(data.description || '').trim(),
  category: data.category,
  template: data.template || 'clothing',
  sizes: Array.isArray(data.sizes) ? data.sizes : [],
  colors: Array.isArray(data.colors) ? data.colors : [],
  ram: Array.isArray(data.ram) ? data.ram : [],
  storage: Array.isArray(data.storage) ? data.storage : [],
  images: Array.isArray(data.images) ? data.images : [],
  videos: Array.isArray(data.videos) ? data.videos : [],
  min_order_quantity: Number.isInteger(Number(data.min_order_quantity)) ? Number(data.min_order_quantity) : 1,
  max_order_quantity: Number.isInteger(Number(data.max_order_quantity)) ? Number(data.max_order_quantity) : 1000000,
  is_active: data.is_active !== false,
});

export async function getProducts({ storeId, category, includeInactive = false, limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  let query = supabase.from('products').select('*').order('created_at', { ascending: false }).range(safeOffset, safeOffset + safeLimit - 1);
  if (storeId) query = query.eq('store_id', storeId);
  if (category) query = query.eq('category', category);
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getProductCount({ storeId, category, includeInactive = false } = {}) {
  let query = supabase.from('products').select('id', { count: 'exact', head: true });
  if (storeId) query = query.eq('store_id', storeId);
  if (category) query = query.eq('category', category);
  if (!includeInactive) query = query.eq('is_active', true);
  const { count, error } = await query;
  if (error) throw error;
  return Number(count) || 0;
}

export async function getProduct(productId) {
  const { data, error } = await supabase.from('products').select('*, stores(id,store_code,store_name,logo_url,owner_id,average_rating,followers_count)').eq('id', productId).single();
  if (error) throw error;
  return data;
}

export async function createProduct(storeId, data) {
  if (!storeId) throw new Error('معرف المتجر مطلوب');
  const product = cleanProduct(data);
  if (!product.title || product.title.length > 150 || !Number.isFinite(product.price) || product.price <= 0 || !PRODUCT_CATEGORIES.includes(product.category)) throw new Error('بيانات المنتج غير صالحة');
  if (!product.description || product.description.length > 1000) throw new Error('وصف المنتج مطلوب ولا يتجاوز 1000 حرف');
  if (!PRODUCT_TEMPLATES.includes(product.template)) throw new Error('نوع المنتج غير صالح');
  if (!product.images.length) throw new Error('يجب إضافة صورة واحدة على الأقل');
  if (product.min_order_quantity < 1 || product.max_order_quantity < product.min_order_quantity) throw new Error('مجال الكمية غير صالح');
  const { data: row, error } = await supabase.from('products').insert({ store_id: storeId, ...product }).select('*').single();
  if (error) {
    if (error.code === '23514' && /products_template_check|template/i.test(error.message || '')) {
      const repairError = new Error('قاعدة البيانات ما زالت تستخدم قيدًا قديمًا لنوع المنتج. طبّق migration 012_product_schema_runtime_repair.sql ثم أعد المحاولة.');
      repairError.cause = error;
      throw repairError;
    }
    throw error;
  }
  // Generate the visual embedding after publishing without blocking the product save.
  void refreshProductEmbedding(row.id, row.images?.[0], [
    `Title: ${row.title || ''}`,
    `Description: ${row.description || ''}`,
    `Category: ${row.category || ''}`,
    `Template: ${row.template || ''}`,
    `Colors: ${(row.colors || []).join(', ')}`,
  ].join(' | '), row.images || []).catch((error) => {
    if (__DEV__) console.warn('[productService] visual indexing did not complete:', error?.message || error);
  });
  return row;
}

export async function updateProduct(productId, updates = {}) {
  if (!productId) throw new Error('معرف المنتج مطلوب');
  const source = updates && typeof updates === 'object' ? updates : {};
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(source, 'title')) payload.title = String(source.title || '').trim();
  if (Object.prototype.hasOwnProperty.call(source, 'price')) payload.price = Number(source.price);
  if (Object.prototype.hasOwnProperty.call(source, 'description')) payload.description = String(source.description || '').trim();
  if (Object.prototype.hasOwnProperty.call(source, 'category')) payload.category = source.category;
  if (Object.prototype.hasOwnProperty.call(source, 'template')) payload.template = source.template;
  for (const key of ['sizes','colors','ram','storage','images','videos']) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (!Array.isArray(source[key])) throw new Error(`حقل ${key} يجب أن يكون قائمة`);
      payload[key] = source[key];
    }
  }
  for (const key of ['min_order_quantity','max_order_quantity']) {
    if (Object.prototype.hasOwnProperty.call(source, key)) payload[key] = Number(source[key]);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'is_active')) payload.is_active = source.is_active !== false;
  if (!Object.keys(payload).length) throw new Error('لا توجد بيانات لتعديل المنتج');
  if ('title' in payload && (!payload.title || payload.title.length > 150)) throw new Error('اسم المنتج غير صالح');
  if ('description' in payload && (!payload.description || payload.description.length > 1000)) throw new Error('وصف المنتج مطلوب ولا يتجاوز 1000 حرف');
  if ('price' in payload && (!Number.isFinite(payload.price) || payload.price <= 0)) throw new Error('السعر غير صالح');
  if ('category' in payload && !PRODUCT_CATEGORIES.includes(payload.category)) throw new Error('فئة المنتج غير صالحة');
  if ('template' in payload && !PRODUCT_TEMPLATES.includes(payload.template)) throw new Error('نوع المنتج غير صالح');
  if ('images' in payload && !payload.images.length) throw new Error('يجب إضافة صورة واحدة على الأقل');
  if ('min_order_quantity' in payload && (!Number.isInteger(payload.min_order_quantity) || payload.min_order_quantity < 1)) throw new Error('الحد الأدنى للطلب غير صالح');
  if ('max_order_quantity' in payload && (!Number.isInteger(payload.max_order_quantity) || payload.max_order_quantity < 1)) throw new Error('الحد الأقصى للطلب غير صالح');
  if (('min_order_quantity' in payload || 'max_order_quantity' in payload) && Object.keys(payload).length) {
    if ('min_order_quantity' in payload && 'max_order_quantity' in payload && payload.max_order_quantity < payload.min_order_quantity) throw new Error('الحد الأقصى يجب أن يكون أكبر من أو يساوي الحد الأدنى');
  }
  const { data, error } = await supabase.from('products').update(payload).eq('id', productId).select('*').single();
  if (error) {
    if (error.code === '23514' && /products_template_check|template/i.test(error.message || '')) {
      const repairError = new Error('قاعدة البيانات ما زالت تستخدم قيدًا قديمًا لنوع المنتج. طبّق migration 012_product_schema_runtime_repair.sql ثم أعد المحاولة.');
      repairError.cause = error;
      throw repairError;
    }
    throw error;
  }
  const embeddingRelevantChange = ['images', 'title', 'description', 'category', 'template', 'colors']
    .some((key) => Object.prototype.hasOwnProperty.call(payload, key));
  if (embeddingRelevantChange) {
    // refreshProductEmbedding is intentionally non-blocking. Keep the update request
    // fast even when image AI services are slow or temporarily unavailable.
    void refreshProductEmbedding(data.id, data.images?.[0], [
      `Title: ${data.title || ''}`,
      `Description: ${data.description || ''}`,
      `Category: ${data.category || ''}`,
      `Template: ${data.template || ''}`,
      `Colors: ${(data.colors || []).join(', ')}`,
    ].join(' | '), data.images || []).catch((error) => {
      if (__DEV__) console.warn('[productService] visual indexing did not complete:', error?.message || error);
    });
  }
  return data;
}

export async function archiveProduct(productId) {
  if (!productId) throw new Error('معرف المنتج مطلوب');
  const { data, error } = await supabase.from('products').update({ is_active: false }).eq('id', productId).select('id,is_active').single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(productId) { return archiveProduct(productId); }


export async function getStoreRatingSummary(storeId) {
  if (!storeId) return { average: 0, count: 0 };
  const { data: store, error: storeError } = await supabase.from('stores').select('average_rating').eq('id', storeId).single();
  if (storeError) throw storeError;

  // Do not download every product row at once. The database schema does not expose
  // a store-level review count, so we page product ids in bounded chunks and then
  // perform one exact review count query per chunk.
  const PRODUCT_ID_PAGE = 500;
  const productIds = [];
  let offset = 0;
  while (true) {
    const { data: productRows, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('store_id', storeId)
      .range(offset, offset + PRODUCT_ID_PAGE - 1);
    if (productError) throw productError;
    const ids = (productRows || []).map((row) => row.id).filter(Boolean);
    productIds.push(...ids);
    if (ids.length < PRODUCT_ID_PAGE) break;
    offset += ids.length;
  }

  if (!productIds.length) return { average: Number(store?.average_rating) || 0, count: 0 };

  let count = 0;
  for (let i = 0; i < productIds.length; i += PRODUCT_ID_PAGE) {
    const chunk = productIds.slice(i, i + PRODUCT_ID_PAGE);
    const { count: chunkCount, error: reviewError } = await supabase
      .from('order_reviews')
      .select('id', { count: 'exact', head: true })
      .in('product_id', chunk);
    if (reviewError) throw reviewError;
    count += Number(chunkCount) || 0;
  }
  return { average: Number(store?.average_rating) || 0, count };
}

export async function getProductUnitsSold(productId) {
  if (!productId) return 0;
  // Sales totals are intentionally exposed through a narrow security-definer RPC.
  // Product details can be viewed by guests, while the orders table itself must
  // remain protected by its buyer/store-owner RLS policy.
  const { data, error } = await supabase.rpc('get_product_units_sold', {
    p_product_id: productId,
  });
  if (error) throw error;
  return Number(data) || 0;
}

export { refreshProductEmbedding };

export default { getProducts, getProductCount, getProduct, createProduct, updateProduct, archiveProduct, deleteProduct, getStoreRatingSummary, getProductUnitsSold, refreshProductEmbedding };
