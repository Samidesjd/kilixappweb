import { TText, useLanguage } from '../context/LanguageContext';
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing, typography } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { ACCOUNT_TYPE_LABELS } from '../constants/countries';
import { getLocalizedLocationName } from '../constants/algeriaLocations';
function PersonalField({ label, value, icon }) {
  return (
    <View style={fieldStyles.wrap}>
      <TText style={fieldStyles.label}>{label}</TText>
      <View style={fieldStyles.inputRow}>
        <MaterialIcons name={icon} size={22} color={colors.outline} />
        <TText style={fieldStyles.value}>{value || '—'}</TText>
      </View>
    </View>
  );
}

export default function PersonalInfoScreen() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const accountTypeLabel = user?.accountType ? ACCOUNT_TYPE_LABELS[user.accountType] : 'مستورد / تاجر';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="معلوماتي الشخصية" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={36} color={colors.white} />
            </View>
          </View>

          <View style={styles.accountTypeChip}>
            <MaterialIcons name="badge" size={16} color={colors.charcoalText} />
            <TText style={styles.accountTypeText}>{`نوع الحساب: ${accountTypeLabel}`}</TText>
          </View>

          <PersonalField
            label="الاسم الكامل"
            value={[user?.first_name, user?.last_name].filter(Boolean).join(' ')}
            icon="person-outline"
          />
          <PersonalField
            label="رقم الهاتف"
            value={user?.phone}
            icon="call-outline"
          />
          <PersonalField
            label="الولاية"
            value={user?.wilaya ? getLocalizedLocationName(user.wilaya, language) : user?.wilaya}
            icon="place"
          />
          <PersonalField
            label="البريد الإلكتروني"
            value={user?.email}
            icon="mail-outline"
          />

      </ScrollView>
    </SafeAreaView>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { width: '100%', marginBottom: spacing.md },
  label: { ...typography.bodySm, color: colors.onSurfaceVariant, marginBottom: spacing.xs, textAlign: 'right', fontWeight: '600' },
  inputRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 16, paddingHorizontal: spacing.md, backgroundColor: colors.white, minHeight: 52 },
  inputRowFocused: { borderColor: colors.orangeVibrant, borderWidth: 2, shadowColor: colors.orangeVibrant, shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  value: { flex: 1, ...typography.bodyLg, color: colors.onSurface, paddingVertical: spacing.sm, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  avatarWrap: { alignSelf: 'center', width: 88, height: 88, marginBottom: spacing.md },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  accountTypeChip: { flexDirection: 'row-reverse', alignSelf: 'center', alignItems: 'center', gap: 6, backgroundColor: colors.infoContainer, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  accountTypeText: { ...typography.bodySm, color: colors.charcoalText, fontWeight: '700' },
});
