import { TText, LTextInput } from '../context/LanguageContext';
import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, radius, spacing, sizes } from '../theme/theme';

export default function FormInput({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  icon,
  prefix,
  error,
  style,
  ...rest
}) {
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, style]}>
      {label ? <TText style={styles.label}>{label}</TText> : null}
      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
          error && styles.inputRowError,
        ]}
      >
        {icon ? (
          <MaterialIcons
            name={icon}
            size={sizes.iconMd}
            color={error ? colors.error : focused ? colors.orangeVibrant : colors.outline}
          />
        ) : null}
        {prefix ? <TText style={styles.prefix}>{prefix}</TText> : null}
        <LTextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.outline}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textAlign="right"
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden(!hidden)} hitSlop={12}>
            <MaterialIcons name={hidden ? 'visibility-off' : 'visibility'} size={sizes.iconMd} color={colors.outline} />
          </Pressable>
        ) : null}
      </View>
      {error ? <TText style={styles.errorText}>{error}</TText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginBottom: spacing.md },
  label: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
    textAlign: 'right',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    minHeight: sizes.inputHeight,
  },
  inputRowFocused: {
    borderColor: colors.orangeVibrant,
    borderWidth: sizes.borderFocus,
    shadowColor: colors.orangeVibrant,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  inputRowError: { borderColor: colors.error, borderWidth: sizes.borderFocus },
  errorText: { ...typography.bodySm, color: colors.error, textAlign: 'right', marginTop: spacing.xs },
  input: {
    flex: 1,
    ...typography.bodyLg,
    color: colors.onSurface,
    paddingVertical: spacing.sm,
  },
  prefix: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
});
