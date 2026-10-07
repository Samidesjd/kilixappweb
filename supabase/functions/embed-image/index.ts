// Kilix production visual-search embedding service.
// Pipeline: image -> Qwen VLM visual attributes -> E5 semantic embedding (768-D).
// The Hugging Face token is server-side only; the mobile app never receives it.
import { InferenceClient } from 'npm:@huggingface/inference@4.13.28';
import { createClient } from 'npm:@supabase/supabase-js@2';

const EMBEDDING_VERSION = 'kilix-hf-v4-semantic';
const EMBEDDING_DIMENSIONS = 768;
const VLM_MODEL = 'Qwen/Qwen2.5-VL-3B-Instruct';
const E5_MODEL = 'intfloat/e5-base-v2';
const CLASSIFIER_MODEL = 'google/vit-base-patch16-224';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function stripDataUrl(value: string) {
  return String(value || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '');
}

function toBytes(base64: string) {
  const clean = stripDataUrl(base64);
  if (!clean) throw new Error('صورة غير صالحة');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function asArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (value.every((item) => typeof item === 'number')) return value as number[];
  if (value.length === 1) return asArray(value[0]);
  return null;
}

function meanPool(value: unknown): number[] | null {
  const direct = asArray(value);
  if (direct) return direct;
  if (!Array.isArray(value) || !value.length) return null;
  const rows = value.map(asArray).filter((row): row is number[] => Array.isArray(row));
  if (!rows.length) return null;
  const width = rows[0].length;
  if (!width || rows.some((row) => row.length !== width)) return null;
  const out = new Array<number>(width).fill(0);
  for (const row of rows) for (let i = 0; i < width; i += 1) out[i] += Number(row[i]) || 0;
  return out.map((v) => v / rows.length);
}

function normalizeVector(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm) throw new Error('تعذر إنشاء embedding غير صفري');
  return vector.map((value) => value / norm);
}

async function getImageInput(input: { imageBase64?: string; imageUrl?: string }) {
  if (input.imageUrl) {
    const response = await fetch(input.imageUrl, { redirect: 'follow' });
    if (!response.ok) throw new Error(`تعذّر تحميل صورة المنتج (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  }
  return toBytes(input.imageBase64 || '');
}

function dataUrlFromBytes(bytes: Uint8Array, fallbackMime = 'image/jpeg') {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return `data:${fallbackMime};base64,${btoa(binary)}`;
}

async function describeImage(hf: InferenceClient, imageUrl: string, catalogContext = '') {
  const prompt = [
    'Analyze the product in the image for an e-commerce visual similarity engine.',
    'Describe ONLY visible product characteristics; never invent unseen attributes.',
    'Return one concise English line using these fields:',
    'type, category, silhouette, material, dominant_colors, secondary_colors, pattern, finish, distinctive_details, accessories, use_case.',
    'Ignore people, hands, background, room, packaging, shadows, and text that is not part of the product.',
    catalogContext ? `Catalog context for disambiguation only: ${catalogContext}.` : '',
  ].filter(Boolean).join(' ');

  const output = await hf.chatCompletion({
    model: VLM_MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    }],
    max_tokens: 220,
    temperature: 0,
  });

  const content = output?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part: any) => typeof part === 'string' ? part : part?.text || '').join(' ')
    : String(content || '');
  if (!text.trim()) throw new Error('لم يصل وصف بصري صالح');
  return text.trim();
}

async function classifyImage(hf: InferenceClient, bytes: Uint8Array) {
  const output = await hf.imageClassification({
    model: CLASSIFIER_MODEL,
    data: bytes,
  });
  const items = (Array.isArray(output) ? output : [])
    .filter((item: any) => item?.label)
    .sort((a: any, b: any) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 8)
    .map((item: any) => `${item.label} (${Number(item.score || 0).toFixed(2)})`);
  return items.length ? `ImageNet clues: ${items.join(', ')}` : '';
}

async function embedText(hf: InferenceClient, text: string, mode: 'query' | 'passage') {
  const output = await hf.featureExtraction({
    model: E5_MODEL,
    inputs: `${mode}: ${text}`,
    normalize: true,
  });
  const vector = meanPool(output);
  if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding غير صالح: المتوقع ${EMBEDDING_DIMENSIONS}، المستلم ${vector?.length ?? 0}`);
  }
  return normalizeVector(vector);
}

async function buildEmbedding(hf: InferenceClient, input: { imageBase64?: string; imageUrl?: string }, mode: 'query' | 'passage', catalogContext = '') {
  const bytes = await getImageInput(input);
  const imageUrl = input.imageUrl || dataUrlFromBytes(bytes);
  let description = '';
  try {
    description = await describeImage(hf, imageUrl, catalogContext);
  } catch (error) {
    console.warn('[embed-image] VLM failed, using classifier fallback:', error?.message || error);
  }

  if (!description) {
    description = await classifyImage(hf, bytes);
  }
  if (!description) throw new Error('تعذر استخراج خصائص بصرية من الصورة');

  // Keep text context subordinate to the observed image features.
  const searchText = [description, catalogContext ? `Catalog metadata: ${catalogContext}` : '']
    .filter(Boolean)
    .join('. ');
  const embedding = await embedText(hf, searchText, mode);
  return { embedding, description };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method === 'GET') {
    return json({ ok: true, engine: EMBEDDING_VERSION, dimensions: EMBEDDING_DIMENSIONS, models: { vlm: VLM_MODEL, embedding: E5_MODEL } });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const hfKey = Deno.env.get('HUGGINGFACE_API_KEY');
    if (!hfKey) return json({ error: 'HUGGINGFACE_API_KEY غير مُعرَّف في أسرار المشروع' }, 500);

    const body = await req.json();
    const { imageBase64, imageUrl, productId, queryText } = body || {};
    if (!imageBase64 && !imageUrl) return json({ error: 'يجب إرسال imageBase64 أو imageUrl' }, 400);

    const hf = new InferenceClient(hfKey);
    const catalogContext = typeof queryText === 'string' ? queryText.trim().slice(0, 1200) : '';
    const { embedding, description } = await buildEmbedding(
      hf,
      { imageBase64, imageUrl },
      productId ? 'passage' : 'query',
      catalogContext,
    );

    if (!productId) {
      return json({
        success: true,
        embedding,
        dimensions: embedding.length,
        engine: EMBEDDING_VERSION,
        description,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = req.headers.get('Authorization');
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'إعدادات Supabase غير متوفرة داخل الدالة' }, 500);
    if (!authorization) return json({ error: 'يجب تسجيل الدخول لتحديث بصمة المنتج' }, 401);

    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'جلسة المستخدم غير صالحة' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: product, error: productError } = await admin
      .from('products')
      .select('id,store_id')
      .eq('id', productId)
      .maybeSingle();
    if (productError) return json({ error: `تعذّر التحقق من المنتج: ${productError.message}` }, 500);
    if (!product) return json({ error: 'المنتج غير موجود' }, 404);

    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('owner_id')
      .eq('id', product.store_id)
      .maybeSingle();
    if (storeError) return json({ error: `تعذّر التحقق من ملكية المتجر: ${storeError.message}` }, 500);
    if (store?.owner_id !== user.id) return json({ error: 'غير مصرح لك بتعديل هذا المنتج' }, 403);

    const { error: updateError } = await admin
      .from('products')
      .update({ embedding, image_embedding_version: EMBEDDING_VERSION })
      .eq('id', productId);
    if (updateError) return json({ error: `فشل تخزين الـ embedding: ${updateError.message}` }, 500);

    return json({ success: true, productId, dimensions: embedding.length, engine: EMBEDDING_VERSION });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error), engine: EMBEDDING_VERSION }, 500);
  }
});
