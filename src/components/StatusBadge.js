import { TText } from '../context/LanguageContext';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLOR_KEY } from '../constants/orderStatus';

const COLOR_MAP = {
  success: { bg: colors.successContainer, text: colors.success },
  warning: { bg: colors.warningContainer, text: colors.warning },
  info: { bg: colors.infoContainer, text: colors.info },
  error: { bg: colors.errorContainer, text: colors.error },
};

const StatusBadge = React.memo(function StatusBadge({ status, style }) {
  const colorKey = ORDER_STATUS_COLOR_KEY[status] || 'info';
  const label = ORDER_STATUS_LABELS[status] || status;
  const { bg, text } = COLOR_MAP[colorKey];

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <TText style={[styles.text, { color: text }]}>{label}</TText>
    </View>
  );
});

export default StatusBadge;

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.bodySm,
    fontSize: 12,
    fontWeight: '700',
  },
});
