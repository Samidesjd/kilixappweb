create table if not exists public.visual_embedding_backfill_state (
  id boolean primary key default true check (id = true),
  running_until timestamptz,
  last_started_at timestamptz,
  completed_at timestamptz
);

insert into public.visual_embedding_backfill_state (id)
values (true)
on conflict (id) do nothing;

alter table public.visual_embedding_backfill_state enable row level security;

create or replace function public.claim_visual_embedding_backfill()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer := 0;
begin
  update public.visual_embedding_backfill_state
  set running_until = now() + interval '15 minutes',
      last_started_at = now()
  where id = true
    and (running_until is null or running_until < now());
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke all on function public.claim_visual_embedding_backfill() from public, anon, authenticated;
grant execute on function public.claim_visual_embedding_backfill() to service_role;
revoke all on table public.visual_embedding_backfill_state from public, anon, authenticated;
