import { TText, LTextInput } from '../context/LanguageContext';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  KeyboardAvoidingView,
  ScrollView,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import PrimaryButton from '../components/PrimaryButton';
import { colors, spacing, radius, typography } from '../theme/theme';
import { useAuth } from '../context/AuthContext';

const CODE_LENGTH = 6;
const EMPTY_DIGITS = Array(CODE_LENGTH).fill('');

export default function OtpVerificationScreen({ navigation }) {
  const {
    pendingContact,
    pendingMode,
    verifyOtp,
    resendOtp,
    cancelOtp,
    authLoading,
    authError,
    clearAuthError,
    otpResendSeconds,
  } = useAuth();
  const { width } = useWindowDimensions();

  const [digits, setDigits] = useState(EMPTY_DIGITS);
  const [secondsLeft, setSecondsLeft] = useState(otpResendSeconds || 60);
  const [expired, setExpired] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [infoMessage, setInfoMessage] = useState('تم إرسال رمز التحقق.');
  const inputsRef = useRef([]);
  const infoTimerRef = useRef(null);

  const isRegister = pendingMode === 'register';
  const code = digits.join('');
  const contentMaxWidth = Math.min(width - spacing.lg * 2, 420);
  const boxSize = Math.min(52, (contentMaxWidth - spacing.sm * (CODE_LENGTH - 1)) / CODE_LENGTH);

  // عداد التنازل لإعادة الإرسال، وبعد انتهائه يصبح الرمز منتهي الصلاحية حتى تتم إعادة الإرسال
  useEffect(() => {
    if (secondsLeft <= 0) {
      setExpired(true);
      return undefined;
    }
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  // إذا لم تعد هناك جهة اتصال معلّقة (مثلاً بعد إعادة تحميل الشاشة)، ارجع للخلف
  useEffect(() => {
    if (!pendingContact) {
      navigation.goBack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // فتح لوحة المفاتيح تلقائياً على أول خانة فور دخول الشاشة.
  // نستعمل InteractionManager باش ننتظر اكتمال أنيميشن الانتقال (وإغلاق أي مودال سابق)
  // قبل طلب التركيز، مع محاولة احتياطية إضافية لضمان عمل الأمر على أندرويد و iOS.
  useFocusEffect(
    useCallback(() => {
      let fallbackTimer;
      const task = InteractionManager.runAfterInteractions(() => {
        inputsRef.current[0]?.focus();
        fallbackTimer = setTimeout(() => inputsRef.current[0]?.focus(), 150);
      });
      return () => {
        task.cancel();
        if (fallbackTimer) clearTimeout(fallbackTimer);
      };
    }, [])
  );

  const showInfo = useCallback((message) => {
    setInfoMessage(message);
    if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
    infoTimerRef.current = setTimeout(() => setInfoMessage(null), 3000);
  }, []);

  useEffect(() => () => infoTimerRef.current && clearTimeout(infoTimerRef.current), []);

  const handleConfirm = async (finalDigits) => {
    const value = (finalDigits || digits).join('');
    setLocalError(null);
    clearAuthError();

    if (value.length === 0) {
      setLocalError('يرجى إدخال رمز التحقق.');
      return;
    }
    if (value.length !== CODE_LENGTH) {
      setLocalError('يرجى إدخال رمز التحقق كاملاً.');
      return;
    }
    if (expired) {
      setLocalError('انتهت صلاحية رمز التحقق.');
      return;
    }

    const ok = await verifyOtp(value);
    if (ok) {
      if (isRegister) {
        showInfo('تم إنشاء الحساب بنجاح.');
        setTimeout(() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }), 700);
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } else {
      // رمز خاطئ: نمسح الخانات ونعيد التركيز على أول خانة باش يقدر يعاود يدخل الرمز مباشرة
      setDigits(EMPTY_DIGITS);
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
    }
  };

  // يستقبل الكتابة العادية (خانة واحدة) وكذلك اللصق التلقائي (عدة أرقام دفعة واحدة)
  const handleChangeText = (text, index) => {
    if (localError) setLocalError(null);
    if (authError) clearAuthError();

    const cleaned = text.replace(/[^0-9]/g, '');

    if (cleaned.length > 1) {
      // حالة اللصق: نوزّع الأرقام على الخانات بدءاً من الخانة الحالية
      const pasted = cleaned.slice(0, CODE_LENGTH).split('');
      const next = [...digits];
      for (let i = 0; i < pasted.length && index + i < CODE_LENGTH; i += 1) {
        next[index + i] = pasted[i];
      }
      setDigits(next);
      const lastIndex = Math.min(index + pasted.length, CODE_LENGTH) - 1;
      const isComplete = next.every((d) => d !== '');
      if (isComplete) {
        inputsRef.current[CODE_LENGTH - 1]?.blur();
        handleConfirm(next);
      } else {
        inputsRef.current[Math.min(lastIndex + 1, CODE_LENGTH - 1)]?.focus();
      }
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);

    if (cleaned && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== '')) {
      handleConfirm(next);
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && digits[index] === '' && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || authLoading) return;
    setDigits(EMPTY_DIGITS);
    setLocalError(null);
    setExpired(false);
    const result = await resendOtp();
    if (result?.ok) {
      showInfo('تم إرسال رمز التحقق.');
      setSecondsLeft(otpResendSeconds || 60);
      inputsRef.current[0]?.focus();
    }
  };

  const handleBack = () => {
    cancelOtp();
    navigation.goBack();
  };

  const timerLabel = `${String(Math.floor(Math.max(secondsLeft, 0) / 60)).padStart(2, '0')}:${String(Math.max(secondsLeft, 0) % 60).padStart(2, '0')}`;
  const contactLabel = pendingContact?.value || '';
  const displayError = localError || authError;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <Pressable style={styles.backRow} onPress={handleBack} hitSlop={8}>
          <MaterialIcons name="arrow-forward" size={22} color={colors.onSurfaceVariant} />
          <TText style={styles.backText}>رجوع</TText>
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={[styles.content, { maxWidth: 480, width: '100%', alignSelf: 'center' }]}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="verified-user" size={32} color={colors.orangeVibrant} />
            </View>

            <TText style={styles.title}>تأكيد رمز التحقق</TText>
            <TText style={styles.subtitle}>
              أدخل رمز التحقق المكوّن من 6 أرقام المرسل إلى{'\n'}
              <TText style={styles.contactText}>{contactLabel}</TText>
            </TText>

            {infoMessage ? (
              <View style={styles.infoBanner}>
                <MaterialIcons name="check-circle" size={16} color={colors.success} />
                <TText style={styles.infoText}>{infoMessage}</TText>
              </View>
            ) : null}

            <View style={[styles.otpRow, { maxWidth: contentMaxWidth }]}>
              {digits.map((d, i) => (
                <LTextInput
                  key={i}
                  ref={(el) => { inputsRef.current[i] = el; }}
                  value={d}
                  onChangeText={(t) => handleChangeText(t, i)}
                  onKeyPress={(e) => handleKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={CODE_LENGTH}
                  autoFocus={i === 0}
                  textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
                  autoComplete={i === 0 && Platform.OS === 'android' ? 'sms-otp' : 'off'}
                  selectTextOnFocus
                  style={[
                    styles.otpBox,
                    { width: boxSize, height: boxSize + 10, textAlign: 'center' },
                    d !== '' && styles.otpBoxFilled,
                    displayError && styles.otpBoxError,
                  ]}
                />
              ))}
            </View>

            {displayError ? <TText style={styles.errorText}>{displayError}</TText> : null}

            <View style={styles.resendRow}>
              {secondsLeft > 0 ? (
                <TText style={styles.timerText}>إعادة الإرسال خلال {timerLabel}</TText>
              ) : (
                <Pressable onPress={handleResend} hitSlop={8} disabled={authLoading}>
                  <TText style={styles.resendLink}>إعادة إرسال الرمز</TText>
                </Pressable>
              )}
            </View>

            <PrimaryButton
              title={isRegister ? 'استمرار' : 'تأكيد والدخول'}
              onPress={() => handleConfirm()}
              loading={authLoading}
              disabled={authLoading}
              style={{ marginTop: spacing.xl }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  backText: { ...typography.bodySm, color: colors.onSurfaceVariant, fontWeight: '600' },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  content: { alignItems: 'center', paddingTop: spacing.xl },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warningContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.headlineMobile, color: colors.charcoalText, textAlign: 'center' },
  subtitle: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  contactText: { fontWeight: '800', color: colors.charcoalText },
  infoBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successContainer,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  infoText: { ...typography.bodySm, color: colors.success, fontWeight: '700' },
  otpRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing.xl,
  },
  otpBox: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.white,
    ...typography.headlineMobile,
    fontSize: 22,
    color: colors.charcoalText,
    padding: 0,
  },
  otpBoxFilled: { borderColor: colors.orangeVibrant },
  otpBoxError: { borderColor: colors.error },
  errorText: { ...typography.bodySm, color: colors.error, textAlign: 'center', marginTop: spacing.md },
  resendRow: { marginTop: spacing.lg, alignItems: 'center', minHeight: 24 },
  timerText: { ...typography.bodySm, color: colors.onSurfaceVariant },
  resendLink: { ...typography.bodySm, color: colors.orangeVibrant, fontWeight: '800' },
});
