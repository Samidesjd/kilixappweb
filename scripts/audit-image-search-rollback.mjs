import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const files = [
  'src/screens/ImageSearchScreen.js',
  'src/utils/imageEmbeddingSearch.js',
  'src/services/productService.js',
  'supabase/functions/embed-image/index.ts',
  'supabase/functions/visual-embedding/index.ts',
];
for (const f of files) if (!fs.existsSync(root + f)) throw new Error(`Missing ${f}`);
const img = fs.readFileSync(root + 'src/screens/ImageSearchScreen.js','utf8');
const emb = fs.readFileSync(root + 'src/utils/imageEmbeddingSearch.js','utf8');
const product = fs.readFileSync(root + 'src/services/productService.js','utf8');
if (!img.includes("useState('1:1')")) throw new Error('Image search aspect was not restored');
if (!emb.includes('VISUAL_RPC_MAX_DISTANCE = 0.48')) throw new Error('Current multimodal visual threshold missing');
if (!emb.includes('VISUAL_RERANK_LIMIT = 8') || !emb.includes('VISUAL_RERANK_WEIGHT = 0.35')) throw new Error('Visual rerank constants missing');
if (!emb.includes("match_products_by_visual_embedding_v2")) throw new Error('Multimodal visual RPC missing');
if (product.includes('await visualPromise')) throw new Error('Product visual indexing is still blocking writes');
console.log(JSON.stringify({imageSearchScalabilityAudit:true, nonBlockingProductIndexing:true, boundedVisualRerank:true},null,2));
