-- Version the semantic image embedding space so stale vectors from older engines
-- are never mixed with the current search model.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_embedding_version TEXT;

CREATE INDEX IF NOT EXISTS products_image_embedding_version_idx
  ON public.products (image_embedding_version)
  WHERE is_active = TRUE;

CREATE OR REPLACE FUNCTION public.match_products_by_embedding(
  query_embedding vector(768),
  match_count int DEFAULT 12,
  max_distance float DEFAULT 0.78
)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
AS $$
  SELECT p.*
  FROM public.products p
  WHERE p.is_active = TRUE
    AND p.embedding IS NOT NULL
    AND p.image_embedding_version = 'kilix-hf-v4-semantic'
    AND (p.embedding <=> query_embedding) <= max_distance
  ORDER BY p.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 60);
$$;
