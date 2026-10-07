import { TText, LTextInput } from '../context/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme/theme';

export default function PhoneEmailSheet({ visible, onClose, onSubmit, loading, submitLabel = 'استمرار' }) {
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) {
      setValue('');
      setPassword('');
      setShowPassword(false);
      setError(null);
    }
  }, [visible]);

  const handleClose = () => {
    Keyboard.dismiss();
    setValue('');
    setPassword('');
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('يرجى إدخال البريد الإلكتروني.');
      return;
    }
    if (!trimmed.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (!password || password.length < 6) {
      setError('يرجى إدخال كلمة سر لا تقل عن 6 أحرف.');
      return;
    }
    setError(null);
    onSubmit(trimmed, password);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetInner}>
              <View style={styles.handle} />

              <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </Pressable>

              <TText style={styles.title}>تسجيل الدخول أو إنشاء حساب</TText>
              <TText style={styles.description}>أدخل بريدك الإلكتروني للمتابعة</TText>

              <View style={[styles.inputRow, error && styles.inputRowError]}>
                <MaterialIcons
                  name="mail-outline"
                  size={20}
                  color={error ? colors.error : colors.orangeVibrant}
                />
                <LTextInput
                  style={styles.input}
                  placeholder="البريد الإلكتروني"
                  placeholderTextColor={colors.outline}
                  value={value}
                  onChangeText={(t) => {
                    setValue(t);
                    if (error) setError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                  textAlign="right"
                />
              </View>
              <View style={[styles.inputRow, styles.passwordRow, error && styles.inputRowError]}>
                <MaterialIcons
                  name="lock-outline"
                  size={20}
                  color={error ? colors.error : colors.orangeVibrant}
                />
                <LTextInput
                  style={styles.input}
                  placeholder="كلمة السر"
                  placeholderTextColor={colors.outline}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                  textAlign="right"
                />
                <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </Pressable>
              </View>

              {error ? <TText style={styles.errorText}>{error}</TText> : null}

              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  loading && styles.submitBtnDisabled,
                  pressed && !loading && styles.submitBtnPressed,
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <TText style={styles.submitText}>{loading ? 'جاري المعالجة...' : submitLabel}</TText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,10,5,0.45)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 1.5,
    alignItems: 'center',
    width: '100%',
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
  inputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceContainerLow,
    minHeight: 56,
  },
  inputRowError: { borderColor: colors.error },
  passwordRow: { marginTop: spacing.sm },
  input: { flex: 1, ...typography.bodyLg, color: colors.onSurface, paddingVertical: spacing.sm, minHeight: 44 },
  errorText: { ...typography.bodySm, color: colors.error, textAlign: 'right', marginTop: spacing.xs },
  submitBtn: {
    marginTop: spacing.lg,
    minHeight: 56,
    backgroundColor: colors.orangeVibrant,
    borderRadius: radius.xl,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.orangeVibrant,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  submitBtnPressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { ...typography.titleMd, color: colors.white, fontWeight: '700' },
});