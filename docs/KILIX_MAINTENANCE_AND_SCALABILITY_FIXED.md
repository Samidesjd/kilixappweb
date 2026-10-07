# Kilix — Maintenance & Scalability Fixes

This version keeps the database schema and all Supabase migrations unchanged.

## Fixed in application code

- Merchant inventory is paginated in 50-product pages and shows an exact active-product count.
- Store detail catalog is paginated in 40-product pages and shows an exact active-product count.
- About statistics no longer download every active product just to count merchants.
- Conversations are paginated at 50 chats per page. Unread counts are batched instead of issuing two queries per chat. Latest-message previews are loaded from a bounded batch.
- `CreateStoreScreen` no longer renders the complete inventory in one ScrollView.
- Product visual/semantic indexing is fully non-blocking after a product write; AI latency cannot block create/update completion.
- Visual re-ranking constants are now defined and optional re-ranking fails soft, preserving the primary visual-search path.
- `MessagesScreen` supports loading more conversations as the list grows.

## Deliberately unchanged

- `supabase/migrations/*` and database schema/functions.
- Expo/package configuration.
- Authentication, order RPC contracts, RLS model, and storage schema.

## Scaling model

The application now loads catalogs, inventory, and conversations incrementally. A merchant can therefore have thousands of products without requiring the mobile client to download/render the entire catalog at once.

The next architectural step for a much larger traffic tier would be a database-level conversation summary RPC (latest-message preview + unread count per chat). That was intentionally **not** added here because this request required zero database changes.
