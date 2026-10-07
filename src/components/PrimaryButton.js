import { TText } from '../context/LanguageContext';
import React from 'react';
import { Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, typography, spacing, sizes, buttonShadow } from '../theme/theme';

export default function PrimaryButton({
  title,
  onPress,
  variant = 'filled', // filled | outline | navy
  loading = false,
  disabled = false,
  icon,
  style,
}) {
  const isOutline = variant === 'outline';
  const isNavy = variant === 'navy';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        isOutline && styles.outline,
        isNavy && styles.navy,
        !isOutline && !isNavy && styles.filled,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.charcoalText : colors.white} />
      ) : (
        <>
          {icon ? <MaterialIcons name={icon} size={sizes.iconMd} color={isOutline ? colors.onSurfaceVariant : colors.white} /> : null}
          <TText
            style={[
              styles.text,
              isOutline && { color: colors.onSurfaceVariant },
            ]}
          >
            {title}
          </TText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: sizes.buttonHeight,
    paddingVertical: 14,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filled: {
    backgroundColor: colors.orangeVibrant,
    ...buttonShadow,
  },
  navy: {
    backgroundColor: colors.navyDeep,
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  text: {
    ...typography.titleSm,
    color: colors.white,
    fontWeight: '700',
  },
});
