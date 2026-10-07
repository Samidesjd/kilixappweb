# Kilix — تطبيق الهاتف (React Native / Expo)

تطبيق Kilix كامل مبني بـ **React Native** (عبر Expo SDK 54) — تطبيق هاتف حقيقي (iOS / Android). هذي النسخة توسّع المشروع الأصلي بطبقة API كاملة، منصة شراء (تصنيفات + منتجات)، أنواع حسابات حسب البلد، إشعارات فعلية لكل زبون، سجل معاملات/فواتير مرتبط بالطلبات، حالات طلب كاملة (بانتظار الدفع → تم الدفع → قيد التنفيذ → مكتملة)، تسجيل دخول بحساب Google، ونظام رسائل بمحادثات فردية.

## تشغيل المشروع في VS Code

```bash
npm install
npm start
```
ثم امسح QR Code بتطبيق **Expo Go**، أو اضغط `a` / `i` لمحاكي أندرويد/iOS.

## الإضافات الجديدة في هذي النسخة

### 1) طبقة API (`src/api/`)
- `client.js`: عميل fetch عام يضيف التوكن تلقائياً، يدير timeout، ويوحّد شكل الأخطاء.
- `endpoints.js`: كل نقاط الاتصال مقسّمة حسب الميزة — `AuthAPI`, `UserAPI`, `CatalogAPI`, `OrdersAPI`, `InvoicesAPI`, `NotificationsAPI`, `MessagesAPI`, `LocationAPI`.
- `src/config/env.js`: **هنا تحط رابط السيرفر الحقيقي متاعك** (`API_BASE_URL`) ومفاتيح Google OAuth. حالياً القيم placeholder.

كل الشاشات تحاول أولاً تجيب البيانات من الـ API، وإذا السيرفر ماريح (لأنه مازال قيد التطوير) ترجع تلقائياً لبيانات وهمية واقعية في `src/constants/mockData.js` — يعني تقدر تجرب التطبيق كامل بالواجهة قبل ما يكون الـ backend جاهز.

### 2) الحالة العامة (`src/context/`)
- `AuthContext.js`: تسجيل الدخول (عادي + Google عبر `expo-auth-session`)، التسجيل، تسجيل الخروج، تحديث الملف الشخصي، وحفظ الجلسة محلياً (`AsyncStorage`).
- `DataContext.js`: الطلبات، الفواتير، الإشعارات، المحادثات، التصنيفات، المنتجات — مع دوال تحميل (pull-to-refresh) وعدّاد غير مقروء لكل من الإشعارات والرسائل.

### 3) منصة الشراء
- **التصنيفات** (`CategoriesScreen.js` + `src/constants/categories.js`): 8 تصنيفات رئيسية بأقسام فرعية، يمكن الوصول لها من أيقونة أعلى الرئيسية.
- **الرئيسية** تفلتر المنتجات حسب التصنيف المختار وتجيب البيانات من `DataContext`.

### 4) أنواع الحسابات حسب البلد
- `src/constants/countries.js`: قائمة دول (الجزائر، الصين، المغرب، تونس، الإمارات، السعودية) — كل دولة عندها أنواع حسابات متاحة (`مستورد/تاجر` أو `مورّد/مصنّع`). مثلاً التاجر الجزائري يسجّل كمستورد فقط، بينما المصنّع الصيني يسجّل كمورّد فقط، والإمارات تدعم النوعين.
- `CountrySelectionScreen.js` أصبحت تعرض أعلام حقيقية (flagcdn.com) وتفرض اختيار نوع الحساب حسب البلد المختار قبل التأكيد.

### 5) الطلبات بحالاتها الكاملة
- `src/constants/orderStatus.js`: بانتظار الدفع، تم الدفع، قيد التجهيز، تم الشحن، مكتملة، ملغاة.
- `OrdersScreen.js`: تبويبات فعلية تفلتر حسب الحالة، مربوطة بـ `DataContext` مع Pull-to-Refresh.
- `StatusBadge.js`: مكوّن شارة حالة موحّد (ألوان مختلفة لكل حالة) يُستعمل في الطلبات والفواتير.

### 6) سجل المعاملات والفواتير
- `InvoicesScreen.js`: كل فاتورة مرتبطة بطلبها (`orderId`) — الضغط عليها يودّيك مباشرة لتتبع الطلب.

### 7) الإشعارات الفعلية لكل زبون
- `NotificationsScreen.js` (جديدة): سجل إشعارات حقيقي (طلب، دفع، رسالة، نظام) مع حالة مقروء/غير مقروء وعدّاد يظهر كـ badge في **حسابي**.
- `NotificationSettingsScreen.js` القديمة بقيت كما هي لضبط تفضيلات الإشعارات (تفعيل/تعطيل حسب النوع).

### 8) تسجيل الدخول بحساب Google
- `LoginScreen.js`: زر "المتابعة عبر Google" يستعمل `expo-auth-session/providers/google` (يشتغل داخل Expo Go بدون build إضافي).
- **لازم تسوي:** أنشئ 3 OAuth Client IDs من Google Cloud Console (iOS, Android, Web) وحطهم في `src/config/env.js`.

### 9) الرسائل بمحادثات فردية
- `MessagesScreen.js`: قائمة محادثات حقيقية (مع مورّد، أو الدعم) مع عدّاد غير مقروء.
- `ChatScreen.js` (جديدة، شاشة منفصلة في الـ Stack): فتح محادثة فردية وإرسال رسائل فعلية (تُحفظ في `DataContext` وتُرسل للـ API عبر `MessagesAPI.sendMessage`).

## إعداد ما قبل التشغيل الحقيقي (Backend + Google)

1. **رابط الـ API:** عدّل `API_BASE_URL` في `src/config/env.js` لرابط السيرفر الحقيقي.
2. **Google OAuth:** من Google Cloud Console → APIs & Services → Credentials → أنشئ 3 Client IDs (iOS / Android / Web) وضعهم في نفس الملف. الـ scheme المستعمل لإعادة التوجيه هو `kilix` (معرّف في `app.json`).
3. **شكل استجابة الـ API المتوقع:** كل endpoint في `src/api/endpoints.js` مكتوب بشكل REST قياسي (`/auth/login`, `/orders`, `/notifications`...) — عدّل المسارات لو الـ backend عندك مختلف.

## هيكل الملفات (محدّث)

```
TraLinkApp/
├── App.js
├── app.json
├── package.json
├── src/
│   ├── config/env.js              # رابط API + مفاتيح Google
│   ├── api/
│   │   ├── client.js               # عميل fetch عام
│   │   └── endpoints.js            # كل نقاط الاتصال
│   ├── context/
│   │   ├── AuthContext.js          # المستخدم + تسجيل الدخول (عادي/Google)
│   │   └── DataContext.js          # الطلبات/الفواتير/الإشعارات/الرسائل/التصنيفات
│   ├── constants/
│   │   ├── orderStatus.js
│   │   ├── countries.js
│   │   ├── categories.js
│   │   └── mockData.js             # fallback عند غياب الـ backend
│   ├── theme/theme.js
│   ├── components/
│   │   ├── PrimaryButton.js
│   │   ├── ScreenHeader.js
│   │   ├── FormInput.js
│   │   └── StatusBadge.js          # جديد
│   ├── navigation/
│   │   ├── RootNavigator.js
│   │   └── MainTabs.js
│   └── screens/
│       ├── ... (كل الشاشات الأصلية الـ19)
│       ├── CategoriesScreen.js     # جديدة
│       ├── NotificationsScreen.js  # جديدة (سجل الإشعارات الفعلي)
│       └── ChatScreen.js           # جديدة (محادثة فردية)
```

## ملاحظات فنية

- **fallback ذكي:** أي شاشة تعتمد على `DataContext` تشتغل حتى بدون backend حقيقي، لأنها ترجع تلقائياً للبيانات الوهمية عند فشل الطلب — هذا يخليك تكمل تطوير الواجهة بالتوازي مع تطوير السيرفر.
- **الحالة محفوظة محلياً:** جلسة المستخدم (`AsyncStorage`) تبقى بعد إغلاق التطبيق.
- **الخطوات الجاية المقترحة:** ربط شاشة الدفع (`PaymentFlowScreen`) بمزود دفع حقيقي، إضافة سلة شراء (cart) فعلية، وصفحة تفاصيل فاتورة منفصلة (PDF/طباعة).

---
*Generated from the original Stitch/Tailwind HTML mockups — rebuilt with native React Native components so it runs as a real mobile app.*


## تحديث المشروع وFirebase

- تم تحديث المشروع من Expo SDK 51 إلى **Expo SDK 54** حتى يبقى مناسباً لاختبار المشروع عبر Expo Go.
- Expo SDK 54 يستخدم React Native 0.81 وReact 19.1.0. 
- تم إضافة Firebase JavaScript SDK إلى `package.json`.
- إعداد Firebase موجود في `src/config/firebaseConfig.js`.
- لا يوجد `node_modules` داخل المشروع، وهذا مقصود.
- تم حذف `package-lock.json` القديم لأنه كان مربوطاً بإصدارات Expo 51؛ بعد فك الضغط شغّل `npm install` مرة واحدة لإنشاء lockfile جديد.
- لم يتم تغيير معرّفات Android/iOS أو قيم مشروع Firebase التي كانت موجودة في النسخة المرسلة.
- لا تحتاج إلى إنشاء مجلد `android` أو `ios` فقط من أجل استخدام Firebase JS SDK داخل Expo Go.

### أول تشغيل

```bash
npm install
npx expo start -c
```

ثم افتح المشروع في Expo Go المتوافق مع SDK 54.

> ملاحظة: ملف Firebase الحالي يحتوي على `appId` لتطبيق Android. أبقيت القيمة كما أرسلتها ولم أخترع Web App ID. عند بدء الربط الفعلي لخدمات Firebase في التطبيق، إذا كان لديك Web App مسجل داخل مشروع `kilix-35713` فسنستخدم إعداد Web App الخاص به لحزمة Firebase JavaScript.
