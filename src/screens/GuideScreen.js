import { TText } from '../context/LanguageContext';
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';

const STEPS = [
  { title: 'البحث عن المنتج واختيار المورد', body: 'ابحث عن المنتج باستخدام الكلمات المفتاحية أو الصورة، واختر المصنع أو المورد المناسب من بين المصانع الصينية الموثقة.' },
  { title: 'إرسال طلب الاستيراد', body: 'أرسل طلبك عبر المنصة، وسنحوله مباشرة إلى شركة الشحن الشريكة للتواصل مع المصنع والتحقق من السعر والتوفر.' },
  { title: 'تأكيد السعر والشحن', body: 'تتواصل شركة الشحن مع المصنع لتأكيد السعر النهائي، وتحدد أفضل طريقة للشحن (بحري أو جوي)، ثم تعرض عليك التكلفة النهائية للموافقة.' },
  { title: 'الدفع وبدء التنفيذ', body: 'بعد موافقتك على السعر النهائي، يتم الدفع، وتبدأ شركة الشحن في استلام البضاعة من المصنع وتجهيزها للشحن.' },
  { title: 'الشحن والتخليص الجمركي', body: 'تتولى شركة الشحن نقل البضاعة، وإنجاز إجراءات التخليص الجمركي، مع تحديث حالة الطلب في كل مرحلة.' },
  { title: 'الاستلام وإغلاق الطلب', body: 'تستلم بضاعتك في الجزائر، وبعد التأكيد على الاستلام يتم إغلاق الطلب بنجاح.' },
];

const FAQ = [
  { q: 'ما هي أقل كمية يمكنني استيرادها؟', a: 'تعتمد الكمية الدنيا (MOQ) على نوع المنتج والمورد. بعض الموردين يقبلون طلبات صغيرة تبدأ من 50 قطعة، بينما يشترط آخرون حاويات كاملة. نحن نساعدك في التفاوض على أقل كمية ممكنة.' },
  { q: 'كم تستغرق مدة الشحن من الصين للجزائر؟', a: 'الشحن الجوي يستغرق عادةً من 7 إلى 12 يوماً، بينما يستغرق الشحن البحري ما بين 35 إلى 45 يوماً للوصول إلى الموانئ الجزائرية الرئيسية.' },
  { q: 'هل Kilix تضمن جودة المنتجات؟', a: 'نعم، نقدم خدمة فحص الجودة في المصنع قبل الشحن. فريقنا في الصين يقوم بمعاينة البضاعة والتأكد من مطابقتها للمواصفات المتفق عليها قبل إجراء الدفع النهائي للمورد.' },
  { q: 'كيف يتم حساب تكلفة الجمارك؟', a: 'تُحسب التكلفة بناءً على تعريفة الجمارك الجزائرية المخصصة لنوع المنتج (Code SH) وقيمة الفاتورة وتكاليف التأمين والشحن. نقدم لك استشارة تقديرية قبل البدء.' },
];

export default function GuideScreen({ navigation }) {
  const [openStep, setOpenStep] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="دليل الاستخدام" />
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <TText style={styles.headline}>كيف تستورد من الصين؟</TText>
        <TText style={styles.intro}>
          نحن هنا لتبسيط رحلة استيرادك. اتبع هذه الخطوات الست للوصول بمنتجاتك من المصنع في الصين إلى مستودعك في الجزائر.
        </TText>

        {STEPS.map((s, idx) => {
          const open = openStep === idx;
          return (
            <Pressable key={s.title} style={styles.card} onPress={() => setOpenStep(open ? null : idx)}>
              <View style={styles.cardHeader}>
                <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={colors.outline} />
                <View style={styles.stepBadge}><TText style={styles.stepBadgeText}>{idx + 1}</TText></View>
                <TText style={styles.stepTitle}>{s.title}</TText>
              </View>
              {open ? <TText style={styles.stepBody}>{s.body}</TText> : null}
            </Pressable>
          );
        })}

        <View style={styles.faqHeaderRow}>
          <MaterialIcons name="help-center" size={20} color={colors.charcoalText} />
          <TText style={[styles.headline, { marginTop: 0 }]}>أسئلة شائعة</TText>
        </View>
        {FAQ.map((f, idx) => {
          const open = openFaq === idx;
          return (
            <Pressable key={f.q} style={styles.card} onPress={() => setOpenFaq(open ? null : idx)}>
              <View style={styles.cardHeader}>
                <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={colors.outline} />
                <TText style={[styles.stepTitle, { flex: 1 }]}>{f.q}</TText>
              </View>
              {open ? <TText style={styles.stepBody}>{f.a}</TText> : null}
            </Pressable>
          );
        })}

        <View style={styles.contactCard}>
          <TText style={styles.contactTitle}>عندك سؤال؟</TText>
          <TText style={styles.contactSub}>فريق الدعم الفني لدينا متاح للإجابة على جميع استفساراتكم</TText>
          <TText style={styles.contactHours}>من 8:00 صباحاً حتى 10:00 مساءً</TText>
          <Pressable style={styles.contactBtn}>
            <MaterialIcons name="chat-bubble" size={18} color={colors.white} />
            <TText style={styles.contactBtnText}>تواصل معنا</TText>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <TText style={styles.footerBrand}>Kilix</TText>
          <TText style={styles.footerCopy}>© 2026 Kilix DZ Sourcing Pass. جميع الحقوق محفوظة.</TText>
          <View style={styles.footerLinks}>
            <Pressable onPress={() => navigation.navigate('Privacy')}>
              <TText style={styles.footerLink}>سياسة الخصوصية</TText>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Terms')}>
              <TText style={styles.footerLink}>شروط الخدمة</TText>
            </Pressable>
            <TText style={styles.footerLink}>مركز المساعدة</TText>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headline: { ...typography.headlineMobile, color: colors.charcoalText, textAlign: 'right', marginBottom: spacing.sm },
  intro: { ...typography.bodyLg, color: colors.onSurfaceVariant, textAlign: 'right', marginBottom: spacing.md },
  card: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  stepTitle: { ...typography.bodyLg, fontWeight: '700', color: colors.charcoalText, textAlign: 'right', flex: 1 },
  stepBody: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'right', marginTop: spacing.sm, lineHeight: 22 },
  contactCard: { ...cardShadow.level1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceContainerLow, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg, alignItems: 'center' },
  contactTitle: { color: colors.charcoalText, fontFamily: 'Cairo_700Bold', fontSize: 16 },
  contactSub: { color: colors.onSurfaceVariant, fontSize: 13, textAlign: 'center', marginTop: spacing.xs },
  contactHours: { color: colors.outline, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
  contactBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.orangeVibrant, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.md },
  contactBtnText: { color: colors.white, fontFamily: 'Cairo_700Bold', fontSize: 14 },
  faqHeaderRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.sm },
  footer: { alignItems: 'center', marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.surfaceContainerLow, gap: spacing.sm },
  footerBrand: { ...typography.titleMd, color: colors.charcoalText },
  footerCopy: { ...typography.bodySm, fontSize: 12, color: colors.onSurfaceVariant, opacity: 0.7, textAlign: 'center' },
  footerLinks: { flexDirection: 'row-reverse', gap: spacing.md },
  footerLink: { fontSize: 12, color: colors.outline },
});
