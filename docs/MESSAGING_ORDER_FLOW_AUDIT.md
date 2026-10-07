# Kilix Messaging / Order Flow Hardening

Scope: store messaging, merchant order status messages, chat display names, product options in order modal, and order product images.

- Store message opens a server-resolved chat through `open_store_chat(p_store_id)`.
- Conversation display uses `stores.store_name` for store owners and `users.first_name + last_name` for buyers.
- Merchant `shipping` and `out_of_stock` status updates create/reuse a chat and insert the required private message transactionally.
- Buyer notifications for those statuses remain intact.
- Product detail reloads the canonical product row when route data lacks the complete variant arrays/images, so the modal renders the actual published options.
- OrdersScreen displays `orders.image_url` when available and falls back only when no product image exists.
