import { TText, useLocalizedAlert } from '../context/LanguageContext';
import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { COUNTRIES } from '../constants/countries';

// شاشة "البلد": اختيار بلد التوصيل/الاستخدام. الدول المتاحة تُفعّل مباشرة،
// أما غير المتاحة فيسجَّل المستخدم في قائمة انتظار (مطابقة لتصميم Stitch).
export default function CountrySelectionScreen({ navigation, route }) {
  const showLocalizedAlert = useLocalizedAlert();
  const isOnboarding = !!route?.params?.onboarding;
  const [selectedCode, setSelectedCode] = useState('DZ');

  const availableCountries = useMemo(() => COUNTRIES.filter((c) => c.isAvailable), []);
  const comingSoonCountries = useMemo(() => COUNTRIES.filter((c) => !c.isAvailable), []);

  const handleConfirm = () => {
    const country = COUNTRIES.find((c) => c.code === selectedCode);
    if (!country) return;
    if (country.isAvailable) {
      if (isOnboarding) {
        // جزء من تسلسل إنشاء الحساب: نكمل لاختيار العملة ثم الدخول للتطبيق
        navigation.navigate('CurrencySelection', { onboarding: true });
      } else {
        showLocalizedAlert(`تم تحديد ${country.name} كبلدك الحالي`);
        navigation.goBack();
      }
    } else {
      showLocalizedAlert(`تم تسجيلك في قائمة انتظار ${country.name}`, 'ستُبلَّغ فور إطلاق الخدمة في بلدك.');
    }
  };

  const renderRow = (item) => (
    <Pressable key={item.code} onPress={() => setSelectedCode(item.code)} style={styles.row}>
      <Image source={{ uri: item.flag }} style={styles.flag} />
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <TText style={styles.name}>{item.name}</TText>
          <View style={item.isAvailable ? styles.badgeActive : styles.badgeSoon}>
            <TText style={item.isAvailable ? styles.badgeActiveText : styles.badgeSoonText}>
              {item.isAvailable ? 'متاح' : 'قريباً'}
            </TText>
          </View>
        </View>
        <TText style={styles.currency}>{item.currencyLabel}</TText>
      </View>
      <View style={[styles.check, selectedCode === item.code && styles.checkSelected]}>
        {selectedCode === item.code && <MaterialIcons name="check" size={12} color={colors.white} />}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="البلد" />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <TText style={styles.sectionLabel}>متاح الآن</TText>
          <View style={styles.card}>
            {availableCountries.map((item, i) => (
              <React.Fragment key={item.code}>
                {renderRow(item)}
                {i < availableCountries.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View>
          <TText style={styles.sectionLabel}>قريباً</TText>
          <View style={styles.card}>
            {comingSoonCountries.map((item, i) => (
              <React.Fragment key={item.code}>
                {renderRow(item)}
                {i < comingSoonCountries.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.note}>
          <TText style={styles.noteText}>
            اختيار بلد غير متاح حالياً سيضعك في قائمة الانتظار. ستُبلّغ فور إطلاق الخدمة في بلدك.
          </TText>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton title="تأكيد الاختيار" onPress={handleConfirm} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.lg },
  sectionLabel: { ...typography.bodySm, fontSize: 11, letterSpacing: 0.5, color: colors.outline, fontWeight: '700', textAlign: 'right', marginBottom: spacing.sm, textTransform: 'uppercase' },
  card: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14, padding: spacing.md },
  divider: { height: 1, backgroundColor: colors.surfaceContainerLow, marginHorizontal: spacing.md },
  flag: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceContainer, borderWidth: 1.5, borderColor: colors.surfaceContainerLow },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
  name: { ...typography.bodySm, fontSize: 14, fontWeight: '700', color: colors.charcoalText, textAlign: 'right' },
  badgeActive: { backgroundColor: colors.successContainer, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.success },
  badgeActiveText: { fontSize: 10, fontWeight: '700', color: colors.success },
  badgeSoon: { backgroundColor: colors.surfaceContainerLow, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeSoonText: { fontSize: 10, fontWeight: '700', color: colors.outline },
  currency: { ...typography.bodySm, fontSize: 12, color: colors.outline, textAlign: 'right' },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  checkSelected: { backgroundColor: colors.orangeVibrant, borderColor: colors.orangeVibrant },
  note: { backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, padding: spacing.md, borderRightWidth: 3, borderRightColor: colors.outlineVariant },
  noteText: { ...typography.bodySm, fontSize: 12, color: colors.outline, textAlign: 'right', lineHeight: 20 },
  footer: { padding: spacing.md },
});
