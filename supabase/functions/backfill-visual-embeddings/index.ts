import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = 'gemini-embedding-2';
const MODEL_VERSION = 'gemini-embedding-2-768';
const DIMENSIONS = 768;
const CONCURRENCY = 8;
const MAX_PRODUCTS_PER_RUN = 200;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

async function embedImage(apiKey: string, imageUrl: string) {
  const imageResponse = await fetch(imageUrl, { redirect: 'follow' });
  if (!imageResponse.ok) throw new Error(`image ${imageResponse.status}`);
  const bytes = new Uint8Array(await imageResponse.arrayBuffer());
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('image too large');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  const mimeType = (imageResponse.headers.get('content-type') || 'image/jpeg').split(';')[0];

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      content: { parts: [{ inline_data: { mime_type: mimeType, data: btoa(binary) } }] },
      output_dimensionality: DIMENSIONS,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `Gemini ${response.status}`);
  const embedding = body?.embedding?.values;
  if (!Array.isArray(embedding) || embedding.length !== DIMENSIONS) throw new Error('invalid embedding');
  return embedding.map(Number);
}

async function mapWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { await worker(items[index]); } catch (_) { /* one bad image must not stop the batch */ }
    }
  });
  await Promise.all(workers);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !apiKey) return json({ success: false, error: 'الخدمة غير مهيأة' }, 503);

  const userClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ success: false, error: 'جلسة المستخدم غير صالحة' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: claimed, error: claimError } = await admin.rpc('claim_visual_embedding_backfill');
  if (claimError) return json({ success: false, error: claimError.message }, 500);
  if (!claimed) return json({ success: true, started: false, reason: 'already_running' });

  try {
    const { data: pending, error } = await admin.rpc('get_visual_embedding_backfill_batch', {
      batch_size: MAX_PRODUCTS_PER_RUN,
    });
    if (error) throw error;

    let indexed = 0;

    await mapWithConcurrency(pending || [], async (item: any) => {
      const imageUrl = String(item.image_url || '');
      if (!imageUrl || !item.id) return;
      const embedding = await embedImage(apiKey, imageUrl);
      const { error: upsertError } = await admin.from('product_image_embeddings').upsert({
        product_id: item.id,
        image_url: imageUrl,
        image_index: Number(item.image_index) || 0,
        embedding,
        model_version: MODEL_VERSION,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'product_id,image_index' });
      if (upsertError) throw upsertError;
      indexed += 1;
    });

    await admin.from('visual_embedding_backfill_state').update({ running_until: null, completed_at: new Date().toISOString() }).eq('id', true);
    return json({ success: true, started: true, indexed, pending: (pending || []).length });
  } catch (error) {
    await admin.from('visual_embedding_backfill_state').update({ running_until: null }).eq('id', true);
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 200);
  }
});
