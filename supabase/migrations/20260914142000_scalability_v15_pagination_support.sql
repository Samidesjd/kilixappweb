-- Kilix V15 scalability support.
-- Non-destructive compatibility migration: keeps existing business logic and RLS.

create or replace function public.get_product_units_sold(p_product_id uuid)
returns bigint language sql stable security definer set search_path = public
as $$
  select coalesce(sum(o.quantity), 0)::bigint
  from public.orders o
  where o.product_id = p_product_id and o.status = 'completed';
$$;
revoke all on function public.get_product_units_sold(uuid) from public;
grant execute on function public.get_product_units_sold(uuid) to authenticated;

create or replace function public.save_product_visual_embedding(
  p_product_id uuid,
  p_image_url text,
  p_image_index integer,
  p_embedding vector(768),
  p_model_version text default 'gemini-embedding-2-768'
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_product_id is null or p_image_url is null or p_image_index is null or p_image_index < 0 or p_embedding is null then
    raise exception 'invalid_embedding_input';
  end if;
  select s.owner_id into v_owner
  from public.products p join public.stores s on s.id = p.store_id
  where p.id = p_product_id and p.is_active = true;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'not_product_owner'; end if;
  insert into public.product_image_embeddings(product_id,image_url,image_index,embedding,model_version,updated_at)
  values(p_product_id,p_image_url,p_image_index,p_embedding,p_model_version,now())
  on conflict (product_id,image_index) do update set image_url=excluded.image_url, embedding=excluded.embedding, model_version=excluded.model_version, updated_at=excluded.updated_at;
  return true;
end;
$$;
revoke all on function public.save_product_visual_embedding(uuid,text,integer,vector,text) from public;
revoke all on function public.save_product_visual_embedding(uuid,text,integer,vector,text) from anon;
grant execute on function public.save_product_visual_embedding(uuid,text,integer,vector,text) to authenticated;
