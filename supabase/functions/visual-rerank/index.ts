import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { InferenceClient } from 'npm:@huggingface/inference@4.13.28';

const RERANKER_MODEL = 'Qwen/Qwen2.5-VL-3B-Instruct';
const MAX_CANDIDATES = 8;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
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

function toText(content: unknown) {
  if (Array.isArray(content)) {
    return content.map((part: any) => typeof part === 'string' ? part : part?.text || '').join(' ');
  }
  return String(content || '');
}

function clampScore(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

function parseScores(text: string, ids: string[]) {
  const out: Record<string, { score: number; reason: string }> = {};

  // Preferred format: ID | 0.00 | reason
  const preferred = /([A-Za-z0-9_-]+)\s*\|\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\|\s*([^\n\r]+)/g;
  let match;
  while ((match = preferred.exec(text)) !== null) {
    const id = match[1];
    if (!ids.includes(id)) continue;
    const score = clampScore(match[2]);
    if (score === null) continue;
    out[id] = { score, reason: match[3].trim().slice(0, 240) };
  }

  // JSON fallback if the model returns a structured object anyway.
  if (!Object.keys(out).length) {
    const jsonBlock = text.match(/\[[\s\S]*\]/);
    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock[0]);
        for (const item of Array.isArray(parsed) ? parsed : []) {
          const id = String(item?.id || '').trim();
          const score = clampScore(item?.score);
          if (!ids.includes(id) || score === null) continue;
          out[id] = { score, reason: String(item?.reason || '').trim().slice(0, 240) };
        }
      } catch (_) {
        // Ignore malformed model output; caller will safely keep semantic ranking.
      }
    }
  }

  return out;
}

async function fetchImageAsDataUrl(url: string) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`تعذّر تحميل صورة المرشح (${response.status})`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error('صورة المرشح كبيرة جداً');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('صورة المرشح كبيرة جداً');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return `data:${contentType};base64,${btoa(binary)}`;
}

async function normalizeQueryImage(imageBase64: string) {
  const clean = String(imageBase64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '');
  if (!clean) throw new Error('صورة البحث غير صالحة');
  return `data:image/jpeg;base64,${clean}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method === 'GET') return json({ ok: true, model: RERANKER_MODEL, maxCandidates: MAX_CANDIDATES });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const hfKey = Deno.env.get('HUGGINGFACE_API_KEY');
    if (!hfKey) return json({ error: 'HUGGINGFACE_API_KEY غير مُعرَّف في أسرار المشروع' }, 500);

    const body = await req.json();
    const queryImageBase64 = typeof body?.queryImageBase64 === 'string' ? body.queryImageBase64 : '';
    const queryText = typeof body?.queryText === 'string' ? body.queryText.trim().slice(0, 600) : '';
    const candidates = Array.isArray(body?.candidates)
      ? body.candidates
        .filter((item: any) => item?.id && item?.image)
        .slice(0, MAX_CANDIDATES)
        .map((item: any) => ({ id: String(item.id), image: String(item.image), title: String(item.title || '') }))
      : [];

    if (!queryImageBase64 || !candidates.length) return json({ error: 'المعطيات غير مكتملة' }, 400);

    const queryImage = await normalizeQueryImage(queryImageBase64);
    const candidateData = [] as Array<{ id: string; title: string; imageData: string }>;
    for (const candidate of candidates) {
      try {
        candidateData.push({
          id: candidate.id,
          title: candidate.title,
          imageData: await fetchImageAsDataUrl(candidate.image),
        });
      } catch (_) {
        // A single bad product image must not abort the whole search.
      }
    }
    if (!candidateData.length) return json({ success: true, scores: {}, skipped: true });

    const imageParts = candidateData.map((candidate, index) => ({
      type: 'image_url',
      image_url: { url: candidate.imageData },
      _candidateLabel: `CANDIDATE_${index + 1}`,
    }));

    const candidateManifest = candidateData.map((candidate, index) =>
      `CANDIDATE_${index + 1} = ${candidate.id}${candidate.title ? ` (${candidate.title.slice(0, 120)})` : ''}`
    ).join('; ');

    const prompt = [
      'You are the final visual re-ranker for an e-commerce product search.',
      'The first image is the user query image. The remaining images are candidate products.',
      'Score each candidate from 0 to 1 for VISUAL PRODUCT SIMILARITY, not generic category similarity.',
      'Prioritize silhouette, geometry, layout, shape, material appearance, dominant/secondary colors, pattern, distinctive visible details, and overall product design.',
      'Ignore background, camera angle differences, shadows, packaging, watermarks, people, and other non-product content.',
      'Do not reward a candidate merely because it is the same category. A visually different product should score low.',
      queryText ? `Optional user focus: ${queryText}. Use it only as a secondary tie-breaker and never override visible evidence.` : '',
      `Candidate manifest: ${candidateManifest}`,
      'Return exactly one line per candidate in this format: CANDIDATE_N_ID | score | brief reason.',
      'Use only the exact candidate IDs from the manifest. Do not add markdown, headings, or extra lines.',
    ].filter(Boolean).join(' ');

    const hf = new InferenceClient(hfKey);
    const output = await hf.chatCompletion({
      model: RERANKER_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: queryImage } },
          ...imageParts.map((part) => ({ type: part.type, image_url: part.image_url })),
        ],
      }],
      max_tokens: 420,
      temperature: 0,
    });

    const text = toText(output?.choices?.[0]?.message?.content).trim();
    const ids = candidateData.map((item) => item.id);
    const scores = parseScores(text, ids);
    return json({ success: true, scores, model: RERANKER_MODEL });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      model: RERANKER_MODEL,
    }, 200);
  }
});
