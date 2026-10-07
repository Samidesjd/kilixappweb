import { TText } from '../context/LanguageContext';
import React from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';

const OPTIONS = [
  { key: 'cookies', label: 'سياسة ملفات تعريف الارتباط', icon: 'cookie', route: 'CookiePreferences' },
  { key: 'authorization', label: 'حقوق المحتوى', icon: 'admin-panel-settings', route: 'AuthorizationManagement' },
  { key: 'privacy', label: 'سياسة الخصوصية', icon: 'privacy-tip', route: 'Privacy' },
  { key: 'terms', label: 'شروط الاستخدام', icon: 'description', route: 'Terms' },
];

export default function LegalPoliciesSheet({ visible, onClose, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.sheetInner}>
            <View style={styles.handle} />

            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
            </Pressable>

            <TText style={styles.title}>السياسات القانونية</TText>
            <TText style={styles.description}>اختر أحد الخيارات التالية للاطلاع على التفاصيل</TText>

            <View style={styles.optionsCard}>
              {OPTIONS.map((opt, idx) => (
                <Pressable
                  key={opt.key}
                  style={({ pressed }) => [
                    styles.optionRow,
                    idx === OPTIONS.length - 1 && styles.optionRowLast,
                    pressed && styles.optionRowPressed,
                  ]}
                  onPress={() => onSelect(opt.route)}
                >
                  <MaterialIcons name="chevron-left" size={20} color={colors.outline} />
                  <TText style={styles.optionLabel}>{opt.label}</TText>
                  <View style={styles.optionIconWrap}>
                    <MaterialIcons name={opt.icon} size={20} color={colors.orangeVibrant} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,10,5,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  sheetInner: { width: '100%', maxWidth: 480, paddingHorizontal: spacing.lg },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.outlineVariant,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  closeBtn: { position: 'absolute', top: spacing.md, left: spacing.lg, zIndex: 1 },
  title: { ...typography.titleMd, fontSize: 22, color: colors.charcoalText, textAlign: 'center', fontWeight: '800' },
  description: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  optionsCard: {
    ...cardShadow.level1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceContainerLow,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerLow,
  },
  optionRowLast: { borderBottomWidth: 0 },
  optionRowPressed: { backgroundColor: colors.surfaceContainerLow },
  optionLabel: { flex: 1, ...typography.bodyLg, color: colors.charcoalText, textAlign: 'right' },
  optionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.orangeTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
