import { TText } from '../context/LanguageContext';
import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing, typography } from '../theme/theme';

const COOKIE_TEXT = `سياسة ملفات تعريف الارتباط – Kilix

تاريخ السريان: 8 سبتمبر 2026

1. تطبيق الهاتف

لا تعتمد الوظائف الأساسية لتطبيق Kilix على ملفات تعريف الارتباط (Cookies) لتسجيل الدخول أو تنفيذ الطلبات أو المراسلات أو إدارة المنتجات.

2. عند استخدام خدمات مرتبطة بالويب

إذا تم استخدام موقع ويب أو صفحة ويب مرتبطة بخدمات Kilix، فقد تستخدم تلك الصفحة ملفات تعريف الارتباط أو تقنيات مشابهة حسب الحاجة لتشغيلها أو تذكر بعض التفضيلات أو حماية الخدمة. وقد يخضع استخدام هذه التقنيات أيضًا لسياسة الخصوصية والشروط الخاصة بالخدمة المعنية.

3. التحكم والخصوصية

لا تستخدم Kilix ملفات تعريف الارتباط في تطبيق الهاتف لبيع بيانات المستخدمين أو لمشاركة بياناتهم مع شركات إعلانية لأغراض التسويق.

إذا ظهرت مستقبلاً خيارات متعلقة بملفات تعريف الارتباط داخل خدمة ويب تابعة لـ Kilix، فسيتم توضيح الغرض من كل خيار والوسائل المتاحة لإدارته ضمن الخدمة نفسها.`;

export default function CookiePreferencesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="سياسة ملفات تعريف الارتباط" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TText style={styles.text}>{COOKIE_TEXT}</TText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  text: { ...typography.bodySm, color: colors.charcoalText, textAlign: 'right', lineHeight: 23 },
});
