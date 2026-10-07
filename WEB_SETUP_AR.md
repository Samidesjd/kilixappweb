# Kilix Web

تم تجهيز نفس مشروع Kilix للعمل كتطبيق Web باستخدام Expo + React Native Web، مع الحفاظ على نسخة Android/iOS.

## التشغيل محلياً

```bash
npm install
npx expo start --web
```

أو:

```bash
npm run web
```

## إنشاء نسخة الإنتاج

```bash
npm run web:build
```

ستُنشأ ملفات الموقع داخل مجلد `dist/`.

## نشر الموقع

يمكن نشر مجلد `dist` على Vercel أو Netlify أو Cloudflare Pages أو أي استضافة ملفات ثابتة.

## ملاحظات مهمة

- التطبيق يستخدم Supabase كما هو، ولا توجد قاعدة بيانات منفصلة للويب.
- تسجيل الدخول والحسابات تستخدم تخزين المتصفح على Web، بينما Android/iOS يستمران باستخدام SecureStore.
- رفع الصور/الفيديو والمرفقات في Web يستخدم Browser File/Blob، بينما النسخة الأصلية تبقى للمنصات المحمولة.
- المحادثات Realtime وميزة الكتابة تعتمد على Supabase Realtime ولا تحتاج Refresh.
- تم إزالة فرض RTL على كامل التطبيق حتى لا تتحول الفرنسية والإنجليزية إلى RTL.
- لم يتم تغيير منطق الطلبات أو المنتجات أو قاعدة البيانات.

## متطلبات Expo Web

المشروع يستخدم Expo SDK 54 وReact 19.1 وReact Native Web 0.21.
