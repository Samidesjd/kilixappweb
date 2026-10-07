# إعداد قاعدة بيانات Kilix الجديدة

هذه النسخة تعتمد على عقد قاعدة بيانات واحد فقط:

`supabase/migrations/000_canonical_schema.sql`

## الطريقة الموصى بها

1. استخدم مشروع Supabase جديدًا/قاعدة فارغة.
2. اربط مشروع Supabase محليًا من مجلد المشروع.
3. طبّق migrations الموجودة في `supabase/migrations`.
4. تأكد من أن ملف البيئة يحتوي `EXPO_PUBLIC_SUPABASE_URL` و`EXPO_PUBLIC_SUPABASE_ANON_KEY` الصحيحين للمشروع الجديد.
5. في Edge Function الخاصة بالبحث بالصورة، عرّف `HUGGINGFACE_API_KEY` إذا أردت تفعيل البحث البصري وحساب embeddings.

المigrations من 001 إلى 004 فارغة توافقياً؛ العقد الفعلي الكامل موجود في 000.

## ملاحظات مهمة

- لا تُنشئ يدويًا جدولًا آخر باسم `users` أو `products` أو `orders` أو `stores`.
- لا تضف أعمدة بديلة مثل `product_name` أو `name` بدل `title`.
- هوية المستخدم داخل جداول التطبيق هي `auth_id` في `users`، بينما الجداول التي ترتبط بالمشتري/المرسل تستعمل `auth.users.id` في الأعمدة `user_id`/`sender_id`.
- `store_code` و`user_code` يتم توليدهما من قاعدة البيانات.
- أسعار الطلبات تُحسب من المنتج داخل RPC، وليس من السعر الذي ترسله الشاشة.
- حالات الطلب هي: `pending`, `shipping`, `delivered`, `completed`, `out_of_stock`, `cancelled`.

## إصلاح قاعدة البيانات الحالية للمنتجات

إذا ظهر الخطأ `products_template_check` عند إضافة أو تعديل منتج، فهذا يعني أن قاعدة البيانات ما زالت تحمل قيدًا قديمًا من نسخة سابقة. طبّق:

`supabase/migrations/012_product_schema_runtime_repair.sql`

هذا الإصلاح يوسّع قيود `category` و`template` ويضمن وجود حقول خيارات المنتج المستخدمة حاليًا (`sizes`, `colors`, `ram`, `storage`, `images`, `videos`, والكميات)، بدون حذف بيانات المنتجات.
