import { TText } from '../context/LanguageContext';
// مودال احترافي يظهر للمستخدم الضيف عند محاولة تنفيذ إجراء يتطلب حساباً مسجلاً
// (إضافة منتج للسلة، إجراء طلب) — بدون إجبار التسجيل عند مجرد التصفح.

import React from 'react';
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';

export default function GuestAuthModal({
  visible,
  onClose,
  onSignIn,
  onCreateAccount,
  reason = 'cart', // 'cart' | 'order'
}) {
  const { width } = useWindowDimensions();

  const reasonText =
    reason === 'order'
      ? 'لإتمام طلبك بأمان وتتبعه لاحقاً'
      : 'لحفظ سلتك وإدارة مشترياتك بسهولة';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { maxWidth: Math.min(width - 32, 440) }]}
          onPress={() => {}}
        >
          {/* ── Top decorative strip ─────────────────────────────── */}
          <View style={styles.topAccent} />

          {/* ── Icon ─────────────────────────────────────────────── */}
          <View style={styles.iconWrap}>
            <MaterialIcons
              name="lock-outline"
              size={26}
              color={colors.orangeVibrant}
            />
          </View>

          {/* ── Title ────────────────────────────────────────────── */}
          <TText style={styles.title}>أنشئ حساباً للمتابعة</TText>

          {/* ── Body ─────────────────────────────────────────────── */}
          <TText style={styles.body}>
            سجّل دخولك أو أنشئ حساباً مجانياً {reasonText}.
          </TText>

          {/* ── Actions ──────────────────────────────────────────── */}
          <View style={styles.actions}>
            {/* Primary: Sign in */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.primaryBtnPressed,
              ]}
              onPress={onSignIn}
            >
              <MaterialIcons name="login" size={18} color={colors.white} />
              <TText style={styles.primaryBtnText}>تسجيل الدخول</TText>
            </Pressable>

            {/* Secondary: Create account */}
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.secondaryBtnPressed,
              ]}
              onPress={onCreateAccount}
            >
              <MaterialIcons
                name="person-add-alt"
                size={18}
                color={colors.charcoalText}
              />
              <TText style={styles.secondaryBtnText}>إنشاء حساب</TText>
            </Pressable>
          </View>

          {/* ── Dismiss ──────────────────────────────────────────── */}
          <Pressable onPress={onClose} hitSlop={12} style={styles.dismissRow}>
            <TText style={styles.dismissText}>متابعة التصفح</TText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: spacing.lg,
    ...cardShadow.level2,
  },
  topAccent: {
    width: '100%',
    height: 4,
    backgroundColor: colors.orangeVibrant,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.orangeTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.orangeTintBorder,
  },
  title: {
    ...typography.titleMd,
    color: colors.charcoalText,
    textAlign: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  body: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  actions: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    backgroundColor: colors.charcoalText,
    borderRadius: radius.lg,
  },
  primaryBtnPressed: { opacity: 0.88 },
  primaryBtnText: {
    ...typography.bodySm,
    fontWeight: '700',
    color: colors.white,
  },
  secondaryBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
  },
  secondaryBtnPressed: { backgroundColor: colors.surfaceContainerLow },
  secondaryBtnText: {
    ...typography.bodySm,
    fontWeight: '700',
    color: colors.charcoalText,
  },
  dismissRow: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  dismissText: {
    ...typography.bodySm,
    color: colors.outline,
    textAlign: 'center',
  },
});
