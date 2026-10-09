import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@kilix_product_interest_v1';
const MAX_HISTORY = 40;
const DETAIL_WEIGHT = 4;
const DWELL_WEIGHT = 2;

function safeProductSnapshot(product) {
  if (!product?.id) return null;
  const images = Array.isArray(product.images) ? product.images : [];
  return {
    id: String(product.id),
    title: String(product.title || '').slice(0, 180),
    description: String(product.description || '').slice(0, 600),
    category: String(product.category || ''),
    template: String(product.template || ''),
    price: Number.isFinite(Number(product.price)) ? Number(product.price) : null,
    image: String(product.image || images[0] || ''),
    colors: Array.isArray(product.colors) ? product.colors.slice(0, 8).map(String) : [],
    lastSeenAt: Date.now(),
  };
}

export async function getProductActivity() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id) : [];
  } catch (error) {
    if (__DEV__) console.warn('[productActivity] Could not read local interest history:', error?.message || error);
    return [];
  }
}

/**
 * Stores a small, device-local history only. It deliberately does not write to
 * Supabase or alter the database schema. A detail view is a stronger signal
 * than a three-second hover/dwell, and repeat interactions increase interest.
 */
export async function recordProductInterest(product, source = 'detail') {
  const snapshot = safeProductSnapshot(product);
  if (!snapshot) return getProductActivity();

  try {
    const previous = await getProductActivity();
    const existing = previous.find((item) => item.id === snapshot.id);
    const increment = source === 'dwell' ? DWELL_WEIGHT : DETAIL_WEIGHT;
    const nextItem = {
      ...(existing || {}),
      ...snapshot,
      interest: Math.min(100, (Number(existing?.interest) || 0) + increment),
      views: Math.min(999, (Number(existing?.views) || 0) + (source === 'detail' ? 1 : 0)),
      lastSource: source === 'dwell' ? 'dwell' : 'detail',
      lastSeenAt: Date.now(),
    };
    const next = [nextItem, ...previous.filter((item) => item.id !== snapshot.id)].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch (error) {
    if (__DEV__) console.warn('[productActivity] Could not save local interest history:', error?.message || error);
    return getProductActivity();
  }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokens(value) {
  return new Set(normalizeText(value).split(/\s+/).filter((token) => token.length > 1));
}

function textSimilarity(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

function scoreCandidate(candidate, historyItem, now) {
  const ageDays = Math.max(0, now - (Number(historyItem.lastSeenAt) || now)) / 86400000;
  const recency = Math.exp(-ageDays / 14);
  const strength = Math.min(5, Math.max(1, Number(historyItem.interest) || 1));
  let score = 0;

  if (candidate.category && historyItem.category && candidate.category === historyItem.category) score += 5;
  if (candidate.template && historyItem.template && candidate.template === historyItem.template) score += 4;
  score += textSimilarity(
    [candidate.title, candidate.description, candidate.colors?.join(' ')].join(' '),
    [historyItem.title, historyItem.description, historyItem.colors?.join(' ')].join(' ')
  ) * 3;

  const candidatePrice = Number(candidate.price);
  const historyPrice = Number(historyItem.price);
  if (Number.isFinite(candidatePrice) && candidatePrice > 0 && Number.isFinite(historyPrice) && historyPrice > 0) {
    const ratio = Math.min(candidatePrice, historyPrice) / Math.max(candidatePrice, historyPrice);
    score += ratio * 2;
  }

  return score * recency * (0.75 + strength / 5);
}

/**
 * Rank already-loaded, active catalog products against recent local interests.
 * No full-catalog query or embedding-generation request is triggered here.
 */
export function rankPersonalizedProducts(products = [], activity = [], limit = 8, category = 'all') {
  if (!Array.isArray(products) || !Array.isArray(activity) || activity.length === 0) return [];
  const history = activity.filter((item) => item?.id).slice(0, MAX_HISTORY);
  const seenIds = new Set(history.map((item) => String(item.id)));
  const now = Date.now();

  return products
    .filter((product) => product?.id && product.is_active !== false && !seenIds.has(String(product.id)))
    .filter((product) => category === 'all' || !category || product.category === category)
    .map((product) => ({
      product,
      score: history.reduce((total, item) => total + scoreCandidate(product, item, now), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(Number(limit) || 8, 20)))
    .map((item) => item.product);
}

export default { getProductActivity, recordProductInterest, rankPersonalizedProducts };
