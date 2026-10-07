import { TText, LTextInput } from '../context/LanguageContext';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Image, Pressable, useWindowDimensions, ScrollView, Keyboard, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { useAuth } from '../context/AuthContext';

const HERO_RATIO = 1.2863849765258215;
const HERO_MAX_HEIGHT = 460;
const MAX_EMAIL_LENGTH = 254; // الحد الأقصى القياسي لطول البريد الإلكتروني (RFC 5321)
const MAX_TEXT_FIELD_LENGTH = 60; // حماية بسيطة ضد إدخال نصوص مفرطة الطول

// مكوّن Divider مُغلّف بـ React.memo لمنع إعادة الرسم غير الضرورية
const Divider = React.memo(function Divider({ label, style }) {
  return (
    <View style={[styles.dividerRow, style]}>
      <View style={styles.dividerLine} />
      <TText style={styles.dividerLabel}>{label}</TText>
      <View style={styles.dividerLine} />
    </View>
  );
});

export default function WelcomeScreen({ navigation }) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);

  // حقول نافذة تسجيل الدخول بالإيميل وكلمة السر
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // حقول نافذة إنشاء حساب جديد
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // الحصول على دوال المصادقة من Context
  // استخدام الأسماء المدعومة (aliases): login, signup, loginWithGoogle, continueAsGuest
  const { login, signup, continueAsGuest, authLoading } = useAuth();
  const { width } = useWindowDimensions();

  const heroHeight = useMemo(() => Math.min(width * HERO_RATIO, HERO_MAX_HEIGHT), [width]);
  const heroImageStyle = useMemo(() => ({ width, height: heroHeight }), [width, heroHeight]);
  const heroWrapStyle = useMemo(() => [styles.heroWrap, { height: heroHeight }], [heroHeight]);

  const openRegisterSheet = useCallback(() => {
    setRegError('');
    Keyboard.dismiss();
    setTimeout(() => {
      setRegisterModalVisible(true);
    }, 100);
  }, []);

  const handleGuest = useCallback(() => {
    try {
      continueAsGuest();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      console.log('🔴 Guest login error:', error);
    }
  }, [continueAsGuest, navigation]);

  const openLoginSheet = useCallback(() => {
    setLoginError('');
    Keyboard.dismiss();
    setTimeout(() => {
      setSheetVisible(true);
    }, 100);
  }, []);

  const closeLoginSheet = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const switchToRegisterSheet = useCallback(() => {
    setSheetVisible(false);
    setRegError('');
    setTimeout(() => {
      setRegisterModalVisible(true);
    }, 150);
  }, []);

  const closeRegisterSheet = useCallback(() => {
    setRegisterModalVisible(false);
  }, []);

  const handleLoginSubmit = useCallback(async () => {
    setLoginError('');
    setLoginLoading(true);
    const trimmedEmail = loginEmail.trim().toLowerCase();

    if (!trimmedEmail || !loginPassword.trim()) {
      setLoginError('يرجى تعبئة جميع الحقول');
      setLoginLoading(false);
      return;
    }

    // التححقق من صيغة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setLoginError('البريد الإلكتروني غير صحيح');
      setLoginLoading(false);
      return;
    }

    try {
      console.log('🟡 محاولة تسجيل الدخول:', trimmedEmail);
      const result = await login(trimmedEmail, loginPassword);
      
      console.log('🟡 نتيجة تسجيل الدخول:', result);
      
      if (result?.success) {
        console.log('✅ تسجيل الدخول نجح');
        Keyboard.dismiss();
        setSheetVisible(false);
        setLoginEmail('');
        setLoginPassword('');
        setTimeout(() => {
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        }, 500);
      } else {
        const rawMessage = String(result?.message || '');
        const errorMsg = /invalid login credentials|invalid credentials|wrong password|كلمة المرور خاطئة|بيانات الدخول/i.test(rawMessage)
          ? 'كلمة المرور خاطئة'
          : (rawMessage || 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
        console.log('❌ خطأ تسجيل الدخول:', errorMsg);
        // عند الفشل تبقى نافذة تسجيل الدخول مفتوحة ويظهر الخطأ داخلها.
        setLoginError(errorMsg);
        setLoginLoading(false);
        return;
      }
    } catch (error) {
      console.log('❌ خطأ في العملية:', error);
      setLoginError('حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة لاحقاً');
    } finally {
      setLoginLoading(false);
    }
  }, [loginEmail, loginPassword, login, navigation]);

  const handleRegisterSubmit = useCallback(async () => {
    setRegError('');
    setRegLoading(true);

    const trimmedFirstName = regFirstName.trim();
    const trimmedLastName = regLastName.trim();
    const trimmedPhone = regPhone.trim();
    const trimmedEmail = regEmail.trim().toLowerCase();

    if (!trimmedFirstName || !trimmedLastName || !trimmedPhone || !trimmedEmail || !regPassword.trim() || !regConfirmPassword.trim()) {
      setRegError('يرجى تعبئة جميع الحقول المطلوبة');
      setRegLoading(false);
      return;
    }

    // التحقق من صيغة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setRegError('البريد الإلكتروني غير صحيح');
      setRegLoading(false);
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('كلمتا المرور غير متطابقَتين');
      setRegLoading(false);
      return;
    }

    if (regPassword.length < 6) {
      setRegError('كلمة السر يجب أن تكون 6 أحرف على الأقل');
      setRegLoading(false);
      return;
    }

    try {
      console.log('🟡 محاولة إنشاء حساب:', trimmedEmail);
      Keyboard.dismiss();
      
      // استدعاء الدالة signup مع جميع المعاملات: email, password, firstName, lastName, phone
      const result = await signup(trimmedEmail, regPassword, trimmedFirstName, trimmedLastName, trimmedPhone);
      
      console.log('🟡 نتيجة إنشاء الحساب:', result);

      if (result?.success) {
        console.log('✅ إنشاء الحساب نجح');
        setRegisterModalVisible(false);
        setRegFirstName('');
        setRegLastName('');
        setRegPhone('');
        setRegEmail('');
        setRegPassword('');
        setRegConfirmPassword('');
        setTimeout(() => {
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        }, 500);
      } else {
        const errorMsg = result?.message || 'هذا البريد الإلكتروني مسجل مسبقاً أو غير صالح';
        console.log('❌ خطأ إنشاء الحساب:', errorMsg);
        setRegError(errorMsg);
      }
    } catch (error) {
      console.log('❌ خطأ في العملية:', error);
      setRegError('حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة لاحقاً');
    } finally {
      setRegLoading(false);
    }
  }, [regFirstName, regLastName, regPhone, regEmail, regPassword, regConfirmPassword, signup, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} removeClippedSubviews>
        <View style={heroWrapStyle}>
          <Image
            source={require('../../assets/images/auth-hero.png')}
            style={heroImageStyle}
            resizeMode="cover"
          />
        </View>

        <View style={styles.bottomSection}>
          <View style={styles.contentWrapper}>
            <Divider label="المتابعة أو" style={styles.dividerSpacing} />

            <Pressable
              style={({ pressed }) => [styles.authBtn, styles.registerBtn, pressed && styles.authBtnPressed]}
              onPress={openRegisterSheet}
              disabled={authLoading}
            >
              <View style={styles.iconCircleOrange}>
                <MaterialIcons name="person-add-alt-1" size={20} color={colors.white} />
              </View>
              <TText style={styles.authBtnText}>إنشاء حساب</TText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.authBtn, styles.loginBtn, pressed && styles.authBtnPressed]}
              onPress={openLoginSheet}
              disabled={authLoading}
            >
              <View style={styles.iconCircleWhite}>
                <MaterialIcons name="login" size={20} color={colors.orangeVibrant} />
              </View>
              <TText style={styles.authBtnText}>تسجيل الدخول</TText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.guestPressable, pressed && styles.authBtnPressed]}
              onPress={handleGuest}
              disabled={authLoading}
            >
              <TText style={styles.guestHeading}>المتابعة كضيف</TText>
            </Pressable>

            <View style={styles.featuresCard}>
              <View style={styles.featureItem}>
                <MaterialIcons name="shopping-cart" size={28} color={colors.orangeVibrant} />
                <TText style={styles.featureTitle}>التسوق</TText>
                <TText style={styles.featureSub}>تصفح واشتري</TText>
              </View>
              <View style={styles.featureDivider} />
              <View style={styles.featureItem}>
                <MaterialIcons name="store" size={28} color={colors.orangeVibrant} />
                <TText style={styles.featureTitle}>المتجر</TText>
                <TText style={styles.featureSub}>أنشئ متجرك</TText>
              </View>
              <View style={styles.featureDivider} />
              <View style={styles.featureItem}>
                <MaterialIcons name="security" size={28} color={colors.orangeVibrant} />
                <TText style={styles.featureTitle}>آمن</TText>
                <TText style={styles.featureSub}>مشفر ومحمي</TText>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* نافذة تسجيل الدخول */}
      <Modal
        visible={sheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeLoginSheet}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TText style={styles.modalTitle}>تسجيل الدخول</TText>
              <Pressable onPress={closeLoginSheet} hitSlop={10}>
                <MaterialIcons name="close" size={24} color={colors.charcoalText} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {loginError ? <TText style={styles.errorText}>{loginError}</TText> : null}

              <TText style={styles.inputLabel}>البريد الإلكتروني</TText>
              <LTextInput
                style={styles.textInput}
                placeholder="أدخل البريد الإلكتروني"
                placeholderTextColor={colors.onSurfaceVariant}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                editable={!loginLoading}
                maxLength={MAX_EMAIL_LENGTH}
                value={loginEmail}
                onChangeText={setLoginEmail}
              />

              <TText style={styles.inputLabel}>كلمة السر</TText>
              <LTextInput
                style={styles.textInput}
                placeholder="أدخل كلمة السر"
                placeholderTextColor={colors.onSurfaceVariant}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                editable={!loginLoading}
                maxLength={MAX_TEXT_FIELD_LENGTH}
                value={loginPassword}
                onChangeText={setLoginPassword}
              />

              <Pressable
                style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}
                onPress={handleLoginSubmit}
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <TText style={styles.submitBtnText}>دخول</TText>
                )}
              </Pressable>

              <Pressable style={styles.switchToRegisterPressable} onPress={switchToRegisterSheet} disabled={loginLoading}>
                <TText style={styles.switchToRegisterText}>ليس لديك حساب؟ اشترك الآن</TText>
              </Pressable>
            </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* نافذة إنشاء حساب جديد */}
      <Modal
        visible={registerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeRegisterSheet}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TText style={styles.modalTitle}>إنشاء حساب جديد</TText>
              <Pressable onPress={closeRegisterSheet} hitSlop={10}>
                <MaterialIcons name="close" size={24} color={colors.charcoalText} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {regError ? <TText style={styles.errorText}>{regError}</TText> : null}

              <TText style={styles.inputLabel}>الاسم</TText>
              <LTextInput
                style={styles.textInput}
                placeholder="أدخل الاسم"
                placeholderTextColor={colors.onSurfaceVariant}
                autoCorrect={false}
                textContentType="givenName"
                editable={!regLoading}
                maxLength={MAX_TEXT_FIELD_LENGTH}
                value={regFirstName}
                onChangeText={setRegFirstName}
              />

              <TText style={styles.inputLabel}>اللقب</TText>
              <LTextInput
                style={styles.textInput}
                placeholder="أدخل اللقب"
                placeholderTextColor={colors.onSurfaceVariant}
                autoCorrect={false}
                textContentType="familyName"
                editable={!regLoading}
                maxLength={MAX_TEXT_FIELD_LENGTH}
                value={regLastName}
                onChangeText={setRegLastName}
              />

              <TText style={styles.inputLabel}>رقم الهاتف</TText>
              <LTextInput
                style={styles.textInput}
                placeholder="أدخل رقم الهاتف"
                placeholderTextColor={colors.onSurfaceVariant}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                editable={!regLoading}
                maxLength={20}
                value={regPhone}
                onChangeText={setRegPhone}
              />

              <TText style={styles.inputLabel}>البريد الإلكتروني</TText>
              <LTextInput
                style={styles.textInput}
                placeholder="أدخل البريد الإلكتروني"
                placeholderTextColor={colors.onSurfaceVariant}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                editable={!regLoading}
                maxLength={MAX_EMAIL_LENGTH}
                value={regEmail}
                onChangeText={setRegEmail}
              />

              <TText style={styles.inputLabel}>كلمة السر</TText>
              <LTextInput
                style={styles.textInput}
                placeholder="أدخل كلمة السر (6 أحرف على الأقل)"
                placeholderTextColor={colors.onSurfaceVariant}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
                editable={!regLoading}
                maxLength={MAX_TEXT_FIELD_LENGTH}
                value={regPassword}
                onChangeText={setRegPassword}
              />

              <TText style={styles.inputLabel}>تأكيد كلمة السر</TText>
              <LTextInput
                style={styles.textInput}
                placeholder="أعد إدخال كلمة السر"
                placeholderTextColor={colors.onSurfaceVariant}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
                editable={!regLoading}
                maxLength={MAX_TEXT_FIELD_LENGTH}
                value={regConfirmPassword}
                onChangeText={setRegConfirmPassword}
              />

              <Pressable
                style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}
                onPress={handleRegisterSubmit}
                disabled={regLoading}
              >
                {regLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <TText style={styles.submitBtnText}>استمرار</TText>
                )}
              </Pressable>
            </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  heroWrap: {
    width: '100%',
    overflow: 'hidden',
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    backgroundColor: colors.primary,
    ...cardShadow.level2,
  },
  bottomSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  contentWrapper: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  dividerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  dividerSpacing: { marginBottom: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  dividerLabel: { ...typography.titleMd, fontSize: 15, color: colors.charcoalText, fontWeight: '700' },
  authBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: 56,
    width: '100%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.xl,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm + 4,
    shadowColor: '#1B365D',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  registerBtn: { borderColor: colors.orangeVibrant, backgroundColor: '#FFF7EF' },
  loginBtn: { borderColor: colors.outlineVariant, backgroundColor: colors.white },
  authBtnPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  authBtnText: { ...typography.bodyLg, color: colors.charcoalText, fontWeight: '700', flex: 1, textAlign: 'right' },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconCircleWhite: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  iconCircleOrange: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.orangeVibrant },
  googleIcon: { width: 22, height: 22 },
  guestPressable: { marginTop: spacing.sm, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg },
  guestHeading: { ...typography.titleMd, fontSize: 16, color: colors.charcoalText, fontWeight: '800', textAlign: 'center' },
  featuresCard: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  featureItem: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  featureDivider: { width: 1, backgroundColor: colors.outlineVariant, marginVertical: spacing.xs },
  featureTitle: { ...typography.bodySm, fontWeight: '800', color: colors.charcoalText, textAlign: 'center' },
  featureSub: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: colors.onSurfaceVariant, textAlign: 'center' },
  keyboardAvoidingContainer: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.titleLg, color: colors.charcoalText, fontWeight: '800' },
  modalScroll: { paddingBottom: spacing.xl },
  inputLabel: { ...typography.bodyMd, color: colors.charcoalText, fontWeight: '700', textAlign: 'right', marginBottom: spacing.xs, marginTop: spacing.sm },
  textInput: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 12, textAlign: 'right', ...typography.bodyMd, color: colors.charcoalText, backgroundColor: colors.surfaceContainerLow },
  submitBtn: { backgroundColor: colors.orangeVibrant, borderRadius: radius.xl, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  submitBtnPressed: { opacity: 0.85 },
  submitBtnText: { ...typography.bodyLg, color: colors.white, fontWeight: '800' },
  errorText: { color: '#D32F2F', fontWeight: '700', textAlign: 'right', marginBottom: spacing.sm, fontSize: 13, backgroundColor: '#FFEBEE', padding: 10, borderRadius: 8 },
  switchToRegisterPressable: { marginTop: spacing.md, alignSelf: 'flex-start' },
  switchToRegisterText: { color: colors.orangeVibrant, fontWeight: '700', fontSize: 14 },
});