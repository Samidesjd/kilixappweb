import { supabase } from '../config/supabaseConfig';

// Keep the client and backend on one versioned semantic embedding space.
export const IMAGE_EMBEDDING_VERSION = 'kilix-hf-v4-semantic';

const EMBEDDING_DIMENSIONS = 768;
const RPC_MAX_DISTANCE = 0.78;
const MAX_CANDIDATES_TO_RETURN = 50;
const MULTIMODAL_MODEL_VERSION = 'gemini-embedding-2-768';
const VISUAL_RPC_MAX_DISTANCE = 0.48;
const VISUAL_RERANK_LIMIT = 8;
const VISUAL_RERANK_WEIGHT = 0.35;

function parseVector(value) {
  if (Array.isArray(value)) {
    const out = value.map(Number);
    return out.length && out.every(Number.isFinite) ? out : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  try {
    return parseVector(JSON.parse(trimmed));
  } catch (_) {
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const out = trimmed.slice(1, -1).split(',').map((x) => Number(x.trim()));
      return out.length && out.every(Number.isFinite) ? out : null;
    }
  }
  return null;
}

function cosineDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = Number(a[i]);
    const bv = Number(b[i]);
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }
  if (!aNorm || !bNorm) return Infinity;
  const cosine = dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
  return 1 - Math.max(-1, Math.min(1, cosine));
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function lexicalRelevance(product, queryText) {
  const query = normalizeSearchText(queryText);
  if (!query) return 0;
  const tokens = [...new Set(query.split(/\s+/).filter((token) => token.length >= 2))];
  if (!tokens.length) return 0;
  const haystack = normalizeSearchText([
    product?.title,
    product?.description,
    product?.category,
    product?.template,
    ...(Array.isArray(product?.colors) ? product.colors : []),
  ].filter(Boolean).join(' '));
  if (!haystack) return 0;
  let hits = 0;
  for (const token of tokens) if (haystack.includes(token)) hits += 1;
  return hits / tokens.length;
}

function productContext(product) {
  return [
    `Title: ${product?.title || ''}`,
    `Description: ${product?.description || ''}`,
    `Category: ${product?.category || ''}`,
    `Template: ${product?.template || ''}`,
    `Colors: ${Array.isArray(product?.colors) ? product.colors.join(', ') : ''}`,
  ].filter((value) => value.split(':').slice(1).join(':').trim()).join(' | ');
}


export async function computeMultimodalImageEmbedding(imageBase64) {
  const response = await supabase.functions.invoke('visual-embedding', {
    body: { imageBase64 },
  });
  if (response.error) throw new Error(response.error.message || 'فشل إنشاء البصمة البصرية');
  if (response.data?.success === false) {
    const error = new Error(response.data?.error || 'فشل إنشاء البصمة البصرية');
    error.code = response.data?.code;
    throw error;
  }
  const vector = parseVector(response.data?.embedding);
  if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`البصمة البصرية غير صالحة: ${vector?.length ?? 0}`);
  }
  return vector;
}

/** Calculate the semantic query embedding for the selected image. */
export const computeProductMultimodalEmbedding = async (imageUrl) => {
  const response = await supabase.functions.invoke('visual-embedding', {
    body: { imageUrl },
  });
  if (response.error) throw new Error(response.error.message || 'فشل إنشاء البصمة البصرية للمنتج');
  if (response.data?.success === false) throw new Error(response.data?.error || 'فشل إنشاء البصمة البصرية للمنتج');
  const vector = parseVector(response.data?.embedding);
  if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`البصمة البصرية للمنتج غير صالحة: ${vector?.length ?? 0}`);
  }
  return vector;
};

export const computeImageEmbedding = async (imageBase64, queryText = '') => {
  const embedResponse = await supabase.functions.invoke('embed-image', {
    body: {
      imageBase64,
      queryText: queryText?.trim() || undefined,
    },
  });
  if (embedResponse.error) {
    const serverDetail = embedResponse.data?.error || embedResponse.data?.message;
    const detail = serverDetail || embedResponse.error?.message || 'خطأ غير معروف';
    throw new Error(`فشل حساب البصمة: ${detail}`);
  }
  const vector = parseVector(embedResponse.data?.embedding);
  if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding البحث غير صالح: ${vector?.length ?? 0}`);
  }
  return vector;
};

/** Calculate a product embedding for a not-yet-indexed product. */
export const computeProductImageEmbedding = async (imageUrl, productContextText = '') => {
  const embedResponse = await supabase.functions.invoke('embed-image', {
    body: {
      imageUrl,
      queryText: productContextText?.trim() || undefined,
    },
  });
  if (embedResponse.error) {
    const detail = embedResponse.data?.error || embedResponse.error?.message || 'خطأ غير معروف';
    throw new Error(`فشل فهرسة صورة المنتج: ${detail}`);
  }
  const vector = parseVector(embedResponse.data?.embedding);
  if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding المنتج غير صالح: ${vector?.length ?? 0}`);
  }
  return vector;
};

function normalizeCandidateProduct(row, fallback) {
  if (fallback) return fallback;
  return {
    id: row.id,
    title: row.title || '',
    price: Number(row.price) || 0,
    image: Array.isArray(row.images) ? row.images[0] || null : null,
    images: Array.isArray(row.images) ? row.images : [],
    currency: 'دج',
    category: row.category || 'all',
    description: row.description || '',
    colors: Array.isArray(row.colors) ? row.colors : [],
    storeId: row.store_id || null,
    is_active: row.is_active !== false,
    embedding: row.embedding || null,
    imageEmbeddingVersion: row.image_embedding_version || null,
  };
}

async function retrieveMultimodalCandidates(queryEmbedding, limit) {
  const { data, error } = await supabase.rpc('match_products_by_visual_embedding_v2', {
    query_embedding: queryEmbedding,
    match_count: Math.min(Math.max(limit, 1), 50),
    max_distance: VISUAL_RPC_MAX_DISTANCE,
    requested_model_version: MULTIMODAL_MODEL_VERSION,
  });

  if (error) {
    console.warn('[ImageSearch] multimodal RPC failed:', error.message);
    return [];
  }

  return (data || [])
    .filter((row) => row?.id && row.is_active !== false && Number.isFinite(Number(row.distance)))
    .map((row) => ({
      product: normalizeCandidateProduct(row),
      distance: Number(row.distance),
      imageIndex: 0,
    }));
}

/**
 * Production visual search pipeline:
 * 1) retrieve current-version vectors from pgvector;
 * 2) use only persisted visual vectors on the fast path, with a tiny emergency fallback;
 * 3) merge/deduplicate candidates;
 * 4) re-rank with semantic similarity + optional text focus;
 * 5) never allow archived products into the result set.
 */

async function rerankWithVisualModel(queryImageBase64, rankedItems, queryText = '') {
  if (!queryImageBase64 || !rankedItems?.length) return rankedItems;
  const candidates = rankedItems.slice(0, VISUAL_RERANK_LIMIT).map(({ product }) => ({
    id: product?.id,
    image: product?.image,
    title: product?.title || '',
  })).filter((item) => item.id && item.image);
  if (!candidates.length) return rankedItems;

  const response = await supabase.functions.invoke('visual-rerank', {
    body: { queryImageBase64, queryText, candidates },
  });
  if (response.error) {
    if (__DEV__) console.warn('[ImageSearch] optional visual rerank failed:', response.error.message || response.error);
    return rankedItems;
  }
  if (response.data?.success === false) {
    if (__DEV__) console.warn('[ImageSearch] optional visual rerank rejected:', response.data?.error);
    return rankedItems;
  }
  const scores = response.data?.scores || {};
  if (!Object.keys(scores).length) return rankedItems;

  const distanceById = new Map(rankedItems.map((item) => [item.product?.id, Number(item.distance)]));
  const semanticMin = Math.min(...rankedItems.slice(0, VISUAL_RERANK_LIMIT).map((item) => Number(item.distance)).filter(Number.isFinite));
  const semanticMax = Math.max(...rankedItems.slice(0, VISUAL_RERANK_LIMIT).map((item) => Number(item.distance)).filter(Number.isFinite));
  const span = Math.max(semanticMax - semanticMin, 0.0001);

  return rankedItems.map((item, index) => {
    const visual = Number(scores?.[item.product?.id]?.score);
    if (!Number.isFinite(visual)) return item;
    const distance = distanceById.get(item.product?.id);
    const normalizedSemantic = Number.isFinite(distance) ? 1 - ((distance - semanticMin) / span) : 0;
    const combined = (normalizedSemantic * (1 - VISUAL_RERANK_WEIGHT)) + (visual * VISUAL_RERANK_WEIGHT);
    return { ...item, rerankScore: combined, _originalIndex: index };
  }).sort((a, b) => {
    const aHas = Number.isFinite(a.rerankScore);
    const bHas = Number.isFinite(b.rerankScore);
    if (aHas && bHas) return b.rerankScore - a.rerankScore;
    if (aHas) return -1;
    if (bHas) return 1;
    return a._originalIndex - b._originalIndex;
  });
}

export const searchProductsByVisualEmbedding = async (
  products = [],
  queryEmbedding,
  limit = 12,
  options = {}
) => {
  const queryVector = parseVector(queryEmbedding);
  const multimodalVector = parseVector(options?.multimodalQueryEmbedding);
  if ((!queryVector || queryVector.length !== EMBEDDING_DIMENSIONS) && (!multimodalVector || multimodalVector.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error('لا توجد بصمة بحث صالحة');
  }

  // Scalable fast path: the database performs ANN retrieval against the HNSW
  // index and returns only the requested product rows. The client never loads
  // or scans the catalog, regardless of whether it contains 1,000 or 100,000 products.
  if (multimodalVector) {
    const visualMatches = await retrieveMultimodalCandidates(multimodalVector, limit);
    if (visualMatches.length) {
      const ranked = visualMatches
        .filter((item) => item.product?.is_active !== false)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, Math.min(limit, MAX_CANDIDATES_TO_RETURN));

      if (options?.queryText) {
        for (const item of ranked) {
          const lexical = lexicalRelevance(item.product, options.queryText);
          item.score = item.distance - lexical * 0.025;
        }
        ranked.sort((a, b) => (a.score ?? a.distance) - (b.score ?? b.distance));
      }
      return ranked.map(({ product }) => product);
    }
    // Do not substitute a different embedding space when visual search has no
    // indexed match. Returning no visual match is more correct than unrelated results.
    return [];
  }

  // Legacy compatibility path: still uses the existing semantic pgvector RPC,
  // but never scans/downloads the client catalog and never computes embeddings
  // for products during a user search.
  const queryText = String(options?.queryText || '').trim();
  const { data: storedMatches, error: storedError } = await supabase.rpc('match_products_by_embedding', {
    query_embedding: queryVector,
    match_count: Math.min(Math.max(limit * 4, 24), 100),
    max_distance: RPC_MAX_DISTANCE,
  });
  if (storedError) {
    console.warn('[ImageSearch] pgvector search failed:', storedError.message);
    return [];
  }

  return (storedMatches || [])
    .filter((row) => row?.id && row.is_active !== false)
    .map((row) => {
      const product = normalizeCandidateProduct(row);
      const vector = parseVector(row.embedding);
      const distance = cosineDistance(queryVector, vector);
      const lexical = lexicalRelevance(product, queryText);
      return { product, score: Number.isFinite(distance) ? distance - lexical * 0.06 : Infinity };
    })
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.min(limit, MAX_CANDIDATES_TO_RETURN))
    .map(({ product }) => product);
};

/** Legacy-compatible search helper. */
export const uploadAndSearch = async (imageBase64) => {
  const multimodalEmbedding = await computeMultimodalImageEmbedding(imageBase64);
  return searchProductsByVisualEmbedding([], null, 12, { multimodalQueryEmbedding: multimodalEmbedding });
};

export const computeImageEmbeddingLegacy = computeImageEmbedding;

export default {
  IMAGE_EMBEDDING_VERSION,
  uploadAndSearch,
  computeImageEmbedding,
  computeProductImageEmbedding,
  searchProductsByVisualEmbedding,
};
