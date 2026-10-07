-- Kilix V6: true multimodal image embeddings, isolated from existing semantic embeddings.
create table if not exists public.product_image_embeddings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  image_index integer not null default 0,
  embedding vector(768) not null,
  model_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, image_index)
);

create index if not exists product_image_embeddings_product_idx
  on public.product_image_embeddings (product_id);

create index if not exists product_image_embeddings_model_idx
  on public.product_image_embeddings (model_version)
  where model_version is not null;

-- HNSW gives scalable nearest-neighbor retrieval for the visual vectors.
create index if not exists product_image_embeddings_hnsw_idx
  on public.product_image_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.product_image_embeddings enable row level security;

revoke all on public.product_image_embeddings from public;
revoke all on public.product_image_embeddings from anon, authenticated;

create or replace function public.match_product_images_by_visual_embedding(
  query_embedding vector(768),
  match_count integer default 60,
  max_distance double precision default 0.55,
  requested_model_version text default 'gemini-embedding-2-768'
)
returns table (
  product_id uuid,
  image_index integer,
  image_url text,
  distance double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select e.product_id, e.image_index, e.image_url,
         (e.embedding <=> query_embedding)::double precision as distance
  from public.product_image_embeddings e
  join public.products p on p.id = e.product_id
  where p.is_active = true
    and e.model_version = requested_model_version
    and (e.embedding <=> query_embedding) <= max_distance
  order by e.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 120);
$$;

revoke all on function public.match_product_images_by_visual_embedding(vector(768), integer, double precision, text) from public;
grant execute on function public.match_product_images_by_visual_embedding(vector(768), integer, double precision, text) to anon, authenticated;
