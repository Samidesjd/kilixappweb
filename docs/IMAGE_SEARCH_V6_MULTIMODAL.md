# Kilix V6 — Multimodal Image Search

This version extends the existing semantic image-search system without replacing it.

## Search flow
1. Selected image is still prepared by the existing mobile pipeline.
2. The existing Qwen VLM + E5 semantic embedding path is retained.
3. A new Gemini Embedding 2 multimodal image embedding is calculated when available.
4. A dedicated `product_image_embeddings` table stores 768-D image vectors separately from the existing `products.embedding` semantic vector.
5. pgvector/HNSW retrieves visually similar product images directly.
6. The existing semantic search remains the compatible fallback if the multimodal service is unavailable.
7. The existing color fallback remains the last-resort path.
8. Archived products remain excluded.

## Product indexing
When a merchant creates or updates a product, up to six product images are asynchronously indexed in the dedicated visual table. Product save is never blocked by image-search indexing failure.

## Required backend secret
The new multimodal engine uses Google Gemini Embedding 2. The Supabase Edge Function expects the server-side secret:

`GEMINI_API_KEY`

The key is never stored in the mobile app. If it is not configured, the app automatically keeps using the previous semantic image-search engine instead of failing.

Gemini Embedding 2 supports image inputs and 128–3072 output dimensions; this implementation uses the recommended 768-D size. See Google’s current documentation for the multimodal embedding API.
