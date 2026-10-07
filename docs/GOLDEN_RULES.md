# Kilix — قاعدة ذهبية للتعديلات

هذه القاعدة إلزامية لأي تعديل لاحق في المشروع أو قاعدة Supabase:

1. لا يتم تغيير UI/layout أو وظيفة موجودة إلا بطلب صريح.
2. قبل تعديل أي خدمة/Context/Screen/RPC يتم تتبع جميع المستهلكين لها (imports, calls, navigation, SQL/RPC contracts, realtime listeners).
3. أي تغيير في أسماء جداول/أعمدة/RPC يجب أن ينعكس على كل المستهلكين أو يُضاف compatibility layer آمن.
4. أي تعديل على RLS/GRANTS/Triggers/Functions يجب فحص أثره على التسجيل، الدخول، المتجر، المنتجات، الطلبات، المراجعات، الدردشة، الإشعارات، الفوترة، والبحث بالصورة.
5. Realtime: لا تتم إضافة callbacks بعد subscribe، ولا يتم إعادة استخدام قناة بطريقة تسبب تداخل callbacks؛ يتم تنظيف القناة بـ removeChannel عند انتهاء الاشتراك.
6. لا توجد عمليات DB مباشرة من الشاشات؛ الوصول يكون عبر services/contexts.
7. بعد كل تعديل يجب تشغيل فحوصات: imports، syntax، routes، RPC names/signatures، table/column contract، Firebase legacy runtime refs، direct DB access in screens، وRealtime channel patterns.
8. لا يُعتبر التعديل مكتملاً بدون فحص Supabase الفعلي عندما يكون التعديل متعلقاً بقاعدة البيانات أو RPC/RLS.
9. أي مشكلة جديدة تُعزل وتُصلح بأقل تغيير ممكن، مع عدم لمس الأجزاء غير المرتبطة بها.


## Messaging hardening (2026-09-08)
- Store messaging resolves the owner server-side with `open_store_chat(p_store_id)`; the client no longer trusts an owner id passed from the store screen for chat creation.
- Merchant order status changes create the buyer chat and confirmation/stock-out message in the same database transaction as the status update.
- Conversation display prefers `stores.store_name` for store owners and `users.first_name + last_name` for buyers.
- Product ordering reloads the canonical product record when variant arrays/images are incomplete, so the order modal uses the actual published options.
- OrdersScreen uses `orders.image_url` for the real product image.
