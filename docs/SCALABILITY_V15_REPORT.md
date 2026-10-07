# Kilix Scalability V15

## Scope
Safe performance hardening without changing UI, navigation, business rules, authentication, ordering, chat behavior, account deletion, or image-search architecture.

## Changes
- Products: bounded 40-row pages in the shared product hook with incremental loading and local Realtime updates.
- Orders: service-level paging (50 rows/page); user order screen loads additional pages as the user scrolls.
- Notifications: service-level paging (50 rows/page); notification list loads additional pages.
- Chat messages: service-level paging contract (50 rows/page) is available for incremental migration; existing chat Realtime behavior remains unchanged.
- Product service: product list reads are bounded to 50 rows by default; product creation/update visual indexing is non-fatal and no longer blocks the saved product UI flow.
- Database: existing indexes and RLS retained; no destructive schema changes.
- Vector search: existing HNSW architecture retained; no on-search product-image embedding generation.
- Monitoring: Supabase `pg_stat_statements` is enabled and existing HNSW/GiN/B-tree indexes were verified.
- Backfill: existing `backfill-visual-embeddings` Edge Function remains the safe background mechanism for historical product images.

## Safety checks
- JavaScript syntax checks passed for modified services/context/screens/hook.
- No table/column names were changed.
- No RLS policies were removed.
- No UI layout files were intentionally redesigned.
