-- Kilix V14: scalable image search.
-- The client never downloads the full catalog. pgvector/HNSW returns only a small
-- candidate set and the database joins those IDs to public product fields.

create or replace function public.match_products_by_visual_embedding_v2(
  query_embedding vector(768),
  match_count integer default 12,
  max_distance double precision default 0.55,
  requested_model_version text default 'gemini-embedding-2-768'
)
returns table (
  id uuid,
  title text,
  price numeric,
  images jsonb,
  category text,
  description text,
  colors jsonb,
  store_id uuid,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  distance double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with nearest as (
    select
      e.product_id,
      e.image_index,
      e.image_url,
      (e.embedding <=> query_embedding)::double precision as distance
    from public.product_image_embeddings e
    where e.model_version = requested_model_version
      and (e.embedding <=> query_embedding) <= max_distance
    order by e.embedding <=> query_embedding
    limit least(greatest(coalesce(match_count, 12) * 6, 60), 600)
  ),
  best_per_product as (
    select distinct on (n.product_id)
      n.product_id,
      n.distance
    from nearest n
    order by n.product_id, n.distance
  )
  select
    p.id,
    p.title,
    p.price,
    to_jsonb(p.images) as images,
    p.category,
    p.description,
    to_jsonb(p.colors) as colors,
    p.store_id,
    p.is_active,
    p.created_at,
    p.updated_at,
    b.distance
  from best_per_product b
  join public.products p on p.id = b.product_id
  where p.is_active = true
  order by b.distance
  limit least(greatest(coalesce(match_count, 12), 1), 50);
$$;

revoke all on function public.match_products_by_visual_embedding_v2(vector(768), integer, double precision, text) from public;
grant execute on function public.match_products_by_visual_embedding_v2(vector(768), integer, double precision, text) to anon, authenticated;

-- Efficiently feed the one-time backfill without repeatedly selecting the same
-- first page of products. The caller is the trusted Edge Function only.
create or replace function public.get_visual_embedding_backfill_batch(batch_size integer default 200)
returns table (
  id uuid,
  image_url text,
  image_index integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, x.image_url, x.image_index
  from public.products p
  cross join lateral unnest(coalesce(p.images, array[]::text[])) with ordinality as x(image_url, image_index)
  where p.is_active = true
    and x.image_url is not null
    and not exists (
      select 1
      from public.product_image_embeddings e
      where e.product_id = p.id
        and e.image_index = (x.image_index - 1)::integer
        and e.model_version = 'gemini-embedding-2-768'
    )
  order by p.created_at desc, p.id, x.image_index
  limit least(greatest(coalesce(batch_size, 200), 1), 300);
$$;

revoke all on function public.get_visual_embedding_backfill_batch(integer) from public, anon, authenticated;
grant execute on function public.get_visual_embedding_backfill_batch(integer) to service_role;

analyze public.product_image_embeddings;
analyze public.products;
