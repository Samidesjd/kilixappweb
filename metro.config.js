// إعداد Metro الخاص بمشروع Kilix.
//
// المشكلة: بداية من Expo SDK 53، صار Metro يعتمد افتراضيًا على حقل
// "exports" في package.json لتحديد أي نسخة من المكتبة يجيبها (بدل الحقول
// القديمة زي "main"). بعض المكتبات — وعلى رأسها Firebase JS SDK — بتشاور
// على نسخة JS حديثة فيها صيغة "private class fields" (زي #field)، ومحرك
// Hermes المستخدم داخل Expo Go لسه معندوش دعم كامل لهذه الصيغة، فبيرمي:
// "SyntaxError: private properties are not supported".
//
// هذا الحل موثّق رسميًا من فريق Expo (راجع: expo/expo#36588) وهو تعطيل
// حل exports الحديث، عشان يرجع Metro يستخدم الحقول التقليدية (main/browser)
// المتوافقة مع Hermes.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = false;
config.resolver.sourceExts.push('cjs');

module.exports = config;
