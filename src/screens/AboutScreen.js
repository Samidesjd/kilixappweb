import { TText } from '../context/LanguageContext';
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { getAboutStats } from '../services/aboutService';

const FEATURES = [
  { icon: 'storefront',     title: 'توريد مباشر',     sub: 'تواصل مباشر مع الموردين' },
  { icon: 'local-shipping', title: 'شحن موثوق',         sub: 'شحن امن ودفع عند الاستلام' },
  { icon: 'verified-user',  title: 'أمان المعاملات',     sub: 'معاملا امنة وتوثيق كامل للطلبات' },
];

const INITIAL_STATS = [
  { value: '—', label: 'منتج متاح', accent: true },
  { value: '—', label: 'تاجر نشط' },
  { value: '—', label: 'شركة شحن' },
  { value: '—', label: 'مستخدم' },
];

const formatCount = (value) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '0';

export default function AboutScreen({ navigation }) {
  const [stats, setStats] = useState(INITIAL_STATS);

  const refreshStats = useCallback(async () => {
    try {
      const result = await getAboutStats();
      setStats([
        { value: formatCount(result.products), label: 'منتج متاح', accent: true },
        { value: formatCount(result.merchantCount), label: 'تاجر مسجل' },
        { value: formatCount(result.shippingCompanies), label: 'شركة شحن' },
        { value: formatCount(result.users), label: 'مستخدم' },
      ]);
    } catch (error) {
      if (__DEV__) console.error('[AboutScreen] stats load error:', error);
    }
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="عن Kilix" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.brandBlock}>
          <Image
            source={require('../../assets/images/kilix-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <TText style={styles.version}>الإصدار 1.2.0</TText>
          <TText style={styles.tagline}>
            وسيط ذكي يربط التجار الجملة بتجار التجزئة  — بدون وسطاء، بدون تعقيد.
          </TText>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <TText style={[styles.statValue, s.accent && { color: colors.orangeVibrant }]}>{s.value}</TText>
              <TText style={styles.statLabel}>{s.label}</TText>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <TText style={styles.sectionTitle}>لماذا Kilix؟</TText>
          <View style={styles.card}>
            {FEATURES.map((f, i) => (
              <View key={f.title} style={[styles.featureRow, i < FEATURES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow }]}>
                <View style={styles.featureIconWrap}>
                  <MaterialIcons name={f.icon} size={20} color={colors.navyDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <TText style={styles.featureTitle}>{f.title}</TText>
                  <TText style={styles.featureSub}>{f.sub}</TText>
                </View>
              </View>
            ))}
          </View>
        </View>

        <TText style={styles.footer}>© 2026 Kilix · الجزائر</TText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  brandBlock: { alignItems: 'center', paddingVertical: spacing.lg },
  logo: { width: 140, height: 64 },
  version: { ...typography.caption, color: colors.outline, marginTop: spacing.xs },
  tagline: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.sm, maxWidth: 280, lineHeight: 22 },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    ...cardShadow.level1,
    flexBasis: '47%', flex: 1,
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.md, alignItems: 'center',
  },
  statValue: { ...typography.titleMd, color: colors.charcoalText, fontWeight: '800' },
  statLabel: { ...typography.caption, color: colors.onSurfaceVariant, marginTop: 2, textAlign: 'center' },
  section: { marginBottom: spacing.md, gap: spacing.xs },
  sectionTitle: { ...typography.bodySm, fontWeight: '700', color: colors.outline, textAlign: 'right', marginBottom: spacing.xs },
  card: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden' },
  featureRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md },
  featureIconWrap: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { ...typography.bodySm, fontWeight: '700', color: colors.charcoalText, textAlign: 'right' },
  featureSub: { ...typography.caption, color: colors.onSurfaceVariant, textAlign: 'right', marginTop: 2, lineHeight: 16 },
  footer: { ...typography.caption, color: colors.outlineVariant, textAlign: 'center', marginTop: spacing.md },
});
