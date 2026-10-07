import { TText } from '../context/LanguageContext';
import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';

import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
const CURRENCIES = [
  { code: 'DZD', symbol: 'دج', country: 'الجزائر', name: 'دينار جزائري', flag: 'https://flagcdn.com/w80/dz.png' },
  { code: 'TND', symbol: 'د.ت', country: 'تونس', name: 'دينار تونسي', flag: 'https://flagcdn.com/w80/tn.png' },
  { code: 'MAD', symbol: 'د.م', country: 'المغرب', name: 'درهم مغربي', flag: 'https://flagcdn.com/w80/ma.png' },
  { code: 'LYD', symbol: 'د.ل', country: 'ليبيا', name: 'دينار ليبي', flag: 'https://flagcdn.com/w80/ly.png' },
];

export default function CurrencySelectionScreen({ navigation, route }) {
  const isOnboarding = !!route?.params?.onboarding;
  const [selected, setSelected] = useState('DZD');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="العملة" />
      <View style={styles.content}>
        <TText style={styles.sectionLabel}>اختر العملة المفضلة</TText>
        <View style={styles.card}>
          {CURRENCIES.map((c) => (
            <Pressable key={c.code} onPress={() => setSelected(c.code)} style={styles.row}>
              <View style={[styles.radio, selected === c.code && styles.radioSelected]}>
                {selected === c.code && <View style={styles.radioDot} />}
              </View>
              <Image source={{ uri: c.flag }} style={styles.flag} />
              <View style={{ flex: 1 }}>
                <TText style={styles.name}>{c.name}</TText>
                <TText style={styles.sub}>{c.country} — {c.code}</TText>
              </View>
              <TText style={styles.symbol}>{c.symbol}</TText>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <PrimaryButton
          title="تأكيد الاختيار"
          onPress={() =>
            isOnboarding
              ? navigation.reset({ index: 0, routes: [{ name: 'Main' }] })
              : navigation.goBack()
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.md },
  sectionLabel: { ...typography.bodySm, color: colors.outline, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'right' },
  card: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  symbol: { ...typography.priceLg, color: colors.charcoalText },
  flag: { width: 28, height: 20, borderRadius: 3, backgroundColor: colors.surfaceContainer },
  name: { ...typography.bodyLg, color: colors.onSurface, textAlign: 'right' },
  sub: { ...typography.bodySm, fontSize: 12, color: colors.outline, textAlign: 'right', marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.orangeVibrant },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.orangeVibrant },
  footer: { padding: spacing.md },
});
