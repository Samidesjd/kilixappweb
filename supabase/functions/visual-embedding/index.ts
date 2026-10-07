import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = 'gemini-embedding-2';
const MODEL_VERSION = 'gemini-embedding-2-768';
const DIMENSIONS = 768;
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

async function imageFromUrl(url: string) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`تعذّر تحميل الصورة (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('الصورة كبيرة جداً');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  const mime = response.headers.get('content-type') || 'image/jpeg';
  return { mimeType: mime.split(';')[0], data: btoa(binary) };
}

function imageFromBase64(value: string) {
  const dataUrlMatch = String(value || '').match(/^data:([^;]+);base64,(.+)$/is);
  return {
    mimeType: dataUrlMatch?.[1] || 'image/jpeg',
    data: stripDataUrl(value),
  };
}

async function embedImage(apiKey: string, image: { mimeType: string; data: string }) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      content: { parts: [{ inline_data: { mime_type: image.mimeType, data: image.data } }] },
      output_dimensionality: DIMENSIONS,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `Gemini embedding failed (${response.status})`);
  const vector = body?.embedding?.values;
  if (!Array.isArray(vector) || vector.length !== DIMENSIONS) {
    throw new Error(`Embedding غير صالح: المتوقع ${DIMENSIONS}، المستلم ${Array.isArray(vector) ? vector.length : 0}`);
  }
  return vector.map(Number);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method === 'GET') return json({ ok: true, model: MODEL, modelVersion: MODEL_VERSION, dimensions: DIMENSIONS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ success: false, code: 'MISSING_GEMINI_API_KEY', error: 'GEMINI_API_KEY غير مُعرَّف في أسرار المشروع' }, 503);

    const body = await req.json();
    const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64 : '';
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : '';
    if (!imageBase64 && !imageUrl) return json({ success: false, error: 'يجب إرسال imageBase64 أو imageUrl' }, 400);

    const image = imageUrl ? await imageFromUrl(imageUrl) : imageFromBase64(imageBase64);
    const embedding = await embedImage(apiKey, image);

    const productId = typeof body?.productId === 'string' ? body.productId : '';
    const imageIndex = Number.isInteger(body?.imageIndex) ? Number(body.imageIndex) : null;
    if (productId && imageIndex !== null && imageUrl) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const authorization = req.headers.get('Authorization');
      if (!supabaseUrl || !serviceRoleKey || !authorization) {
        return json({ success: false, error: 'تعذر التحقق من صلاحية فهرسة صورة المنتج' }, 401);
      }
      const userClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ success: false, error: 'جلسة المستخدم غير صالحة' }, 401);
      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: product } = await admin.from('products').select('id,store_id').eq('id', productId).maybeSingle();
      if (!product) return json({ success: false, error: 'المنتج غير موجود' }, 404);
      const { data: store } = await admin.from('stores').select('owner_id').eq('id', product.store_id).maybeSingle();
      if (store?.owner_id !== user.id) return json({ success: false, error: 'غير مصرح بفهرسة هذا المنتج' }, 403);
      const { error: upsertError } = await admin.from('product_image_embeddings').upsert({
        product_id: productId, image_url: imageUrl, image_index: imageIndex, embedding, model_version: MODEL_VERSION, updated_at: new Date().toISOString()
      }, { onConflict: 'product_id,image_index' });
      if (upsertError) throw new Error(`فشل حفظ البصمة البصرية: ${upsertError.message}`);
    }

    return json({ success: true, embedding, dimensions: embedding.length, model: MODEL, modelVersion: MODEL_VERSION, stored: Boolean(productId && imageIndex !== null) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : String(error), model: MODEL, modelVersion: MODEL_VERSION }, 200);
  }
});
