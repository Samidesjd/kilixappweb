-- Kilix scalability hardening (safe/additive only)
-- This migration intentionally does not rename/drop tables, columns, RPCs, policies,
-- triggers, or existing indexes. It adds only indexes and a concurrency guard.

-- Common product feed: active products ordered newest first.
CREATE INDEX IF NOT EXISTS idx_products_active_created
  ON public.products (is_active, created_at DESC);

-- Store product lists: active products for one store, newest first.
CREATE INDEX IF NOT EXISTS idx_products_store_active_created
  ON public.products (store_id, is_active, created_at DESC);

-- Category feed: active products in a category, newest first.
CREATE INDEX IF NOT EXISTS idx_products_active_category_created
  ON public.products (is_active, category, created_at DESC);

-- Notification list/count paths frequently combine user + read state + time.
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);

-- Chat lookup can be performed in either participant direction. The existing
-- indexes remain untouched; this additive index helps the reverse participant
-- lookup while preserving the current schema and RPC contracts.
CREATE INDEX IF NOT EXISTS idx_chats_participant_2_participant_1
  ON public.chats (participant_2_id, participant_1_id);

-- Product image embedding RPC joins active products by product_id after the
-- vector candidate search. Keep this additive and independent of the HNSW index.
CREATE INDEX IF NOT EXISTS idx_product_image_embeddings_product_model
  ON public.product_image_embeddings (product_id, model_version);
