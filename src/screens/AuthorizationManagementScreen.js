import { TText } from '../context/LanguageContext';
import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing, typography } from '../theme/theme';

const CONTENT_TEXT = `حقوق المحتوى والترخيص – Kilix

1. ملكية المحتوى

يبقى المستخدم أو صاحب الحق الأصلي مالكًا للصور والنصوص والفيديوهات والتعليقات وغيرها من المحتوى الذي يقدمه عبر Kilix، ولا تنتقل الملكية إلى Kilix لمجرد استخدام التطبيق.

2. الترخيص اللازم لتشغيل الخدمة

عند تقديم محتوى إلى Kilix، يمنح المستخدم Kilix ترخيصًا محدودًا وغير حصري لاستخدام المحتوى وتخزينه وعرضه ونسخه بالقدر اللازم لتشغيل الخدمة. يشمل ذلك، بحسب الوظيفة المستخدمة، عرض صور المنتجات والمتاجر، حفظ التقييمات والتعليقات، إظهار المحتوى داخل المحادثات، ومعالجة الصور التي يرسلها المستخدم للبحث أو لإضافة منتج.

3. حدود الترخيص

لا يمنح هذا الترخيص Kilix ملكية المحتوى، ولا يتيح لها استعماله لأغراض إعلانية مستقلة عن تشغيل الخدمة، ولا يتيح بيع محتوى المستخدم أو الترخيص به للغير لأغراض لا تتعلق بالخدمة، إلا إذا كان ذلك مطلوبًا بموجب القانون أو وافق المستخدم على استخدام منفصل.

4. مسؤولية المستخدم عن المحتوى

يؤكد المستخدم أنه يملك الحقوق اللازمة للمحتوى الذي يقدمه، أو لديه إذن باستخدامه. ويجب ألا يتضمن المحتوى انتهاكًا لحقوق الملكية الفكرية أو الخصوصية أو أي حقوق قانونية للغير، أو محتوى غير قانوني أو ضار أو مضلل عمدًا.

5. إزالة المحتوى

يجوز لـ Kilix مراجعة المحتوى عند الحاجة واتخاذ الإجراءات المناسبة، بما في ذلك رفضه أو تقييده أو إزالته، عندما يكون مخالفًا لهذه الشروط أو للقوانين المعمول بها أو عند الحاجة لحماية المستخدمين والخدمة.

6. حذف الحساب

عند حذف الحساب وفق آلية الحذف المتاحة، تتم إزالة المحتوى الشخصي المرتبط بالحساب بالقدر الممكن، مع مراعاة أي بيانات يجب الاحتفاظ بها لأسباب قانونية أو أمنية أو مرتبطة بمعاملة أو نزاع قائم.`;

export default function AuthorizationManagementScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="حقوق المحتوى" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TText style={styles.text}>{CONTENT_TEXT}</TText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  text: { ...typography.bodySm, color: colors.charcoalText, textAlign: 'right', lineHeight: 23 },
});
