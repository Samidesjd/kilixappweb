import { TText, useLanguage, useLocalizedAlert } from '../context/LanguageContext';
import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { ENV } from '../config/env';
import { Linking } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ORDER_STATUS } from '../constants/orderStatus';
import LegalPoliciesSheet from '../components/LegalPoliciesSheet';

function formatK(n) {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return `${n}`;
}

function MenuRow({ icon, label, sub, onPress, danger, badge }) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <MaterialIcons name="chevron-left" size={20} color={colors.outline} />
      <View style={{ flex: 1 }}>
        <TText style={[styles.menuLabel, danger && { color: colors.error }]}>{label}</TText>
        {sub ? <TText style={styles.menuSub}>{sub}</TText> : null}
      </View>
      {badge > 0 ? (
        <View style={styles.badge}>
          <TText style={styles.badgeText}>{badge}</TText>
        </View>
      ) : null}
      <MaterialIcons name={icon} size={22} color={danger ? colors.error : colors.charcoalText} />
    </Pressable>
  );
}

function Section({ title, children }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <TText style={styles.sectionTitle}>{title}</TText>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const showLocalizedAlert = useLocalizedAlert();
  const { user, logout, deleteAccount } = useAuth();
  const { orders, unreadNotificationsCount, loadOrders, loadNotifications, loading } = useData();
  const [refreshing, setRefreshing] = React.useState(false);
  const [legalSheetVisible, setLegalSheetVisible] = React.useState(false);
  const { language, setLanguage, languages } = useLanguage();

  const handleSelectLegalOption = (route) => {
    setLegalSheetVisible(false);
    navigation.navigate(route);
  };

  const completedCount = orders.filter((o) => o.status === ORDER_STATUS.COMPLETED).length;
  // إجمالي المشتريات يعكس الطلبات المؤكدة فقط، وليس الطلبات المعلقة أو الملغاة أو التي نفد مخزونها.
  // حالات الشحن/الاستلام/الإكمال تعني أن الطلب خرج من مرحلة الانتظار وأصبح شراءً مؤكداً.
  const confirmedPurchaseStatuses = [ORDER_STATUS.SHIPPING, ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED];
  const totalSpent = orders
    .filter((o) => confirmedPurchaseStatuses.includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);
  // التوفير يُعرض حالياً بصفر بشكل ثابت إلى حين تفعيل منطق الخصومات/التوفير الفعلي.
  const totalSaved = 0;

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([loadOrders(), loadNotifications()]); } finally { setRefreshing(false); }
  }, [loadOrders, loadNotifications]);

  const handleDeleteAccount = () => {
    showLocalizedAlert(
      'حذف الحساب نهائيًا',
      'سيتم حذف حسابك نهائيًا، بما في ذلك بريدك الإلكتروني وبياناتك الشخصية ومتجرك ومنتجاته وصوره وفيديوهاته والبيانات المرتبطة بحسابك. لا يمكن التراجع عن هذه العملية.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الحساب',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAccount();
            if (result?.success) {
              navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
            } else {
              showLocalizedAlert('تعذر حذف الحساب', result?.message || 'حاول مرة أخرى.');
            }
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing || !!loading.orders || !!loading.notifications} onRefresh={handleRefresh} />}
      >
        <LinearGradient colors={[colors.surfaceContainerLow, colors.background]} style={styles.headerGradient}>
          <View style={styles.topBar}>
            <TText style={styles.topBarBrand}>Kilix</TText>
            <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8}>
              <MaterialIcons name="notifications-none" size={24} color={colors.charcoalText} />
              {unreadNotificationsCount > 0 ? <View style={styles.topBarDot} /> : null}
            </Pressable>
          </View>

          <View style={styles.profileHeader}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <TText style={styles.avatarInitial}>{([user?.first_name, user?.last_name].filter(Boolean).join(' ') || '؟').charAt(0)}</TText>
              </View>
              <View style={styles.verifiedDot}>
                <MaterialIcons name="verified" size={16} color={colors.success} />
              </View>
            </View>
            <TText style={styles.name}>{[user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'المستخدم'}</TText>
            <TText style={styles.phone}>{user?.phone || 'رقم الهاتف غير مضاف'}</TText>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <TText style={styles.statValue}>{completedCount}</TText>
              <TText style={styles.statLabel}>طلبات مكتملة</TText>
            </View>
            <View style={[styles.statCard, styles.statCardDivider]}>
              <TText style={styles.statValue}>{formatK(totalSpent)}</TText>
              <TText style={styles.statLabel}>إجمالي المشتريات</TText>
            </View>
            <View style={styles.statCard}>
              <TText style={styles.statValue}>{formatK(totalSaved)}</TText>
              <TText style={styles.statLabel}>توفير إجمالي</TText>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.md }}>
          <Pressable style={styles.referralCard} onPress={() => navigation.navigate('Referral')}>
          <View style={{ flex: 1 }}>
            <TText style={styles.referralTitle}>ادعُ تاجراً واربح!</TText>
            <TText style={styles.referralSub}>شارك رابطك واحصل على خصومات</TText>
          </View>
          <Pressable style={styles.shareBtn} onPress={() => navigation.navigate('Referral')}>
            <TText style={styles.shareBtnText}>مشاركة</TText>
          </Pressable>
        </Pressable>

        <Section title="الحساب والإعدادات">
          <MenuRow icon="person-outline" label="المعلومات الشخصية" onPress={() => navigation.navigate('PersonalInfo')} />
          <View style={styles.languageRow}>
            <MaterialIcons name="language" size={22} color={colors.charcoalText} />
            <View style={{ flex: 1 }}>
              <TText style={styles.menuLabel}>اللغة</TText>
              <TText style={styles.menuSub}>{languages[language].nativeLabel}</TText>
              <View style={styles.languageOptions}>
                {Object.values(languages).map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setLanguage(item.key)}
                    style={[styles.languageChip, language === item.key && styles.languageChipActive]}
                  >
                    <TText style={[styles.languageChipText, language === item.key && styles.languageChipTextActive]}>
                      {item.key === 'ar' ? 'العربية' : item.key === 'fr' ? 'Français' : 'English'}
                    </TText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <MenuRow icon="notifications-none" label="التنبيهات" badge={unreadNotificationsCount} onPress={() => navigation.navigate('Notifications')} />
          <MenuRow icon="public" label="الدولة" sub="الجزائر" onPress={() => navigation.navigate('CountrySelection')} />
          <MenuRow icon="attach-money" label="العملة" sub="الدينار الجزائري (DZD)" onPress={() => navigation.navigate('CurrencySelection')} />
        </Section>

        <Section title="الطلبات والمعاملات">
          {/* تم استبدال زر الشحنات بـ زر متجرك */}
          <MenuRow icon="storefront" label="متجرك" sub="إدارة منتجاتك وعرضك التجاري" onPress={() => navigation.navigate('CreateStore')} />
        </Section>

        <Section title="الدعم والمساعدة">
          <MenuRow icon="help-outline" label="مركز المساعدة" onPress={() => navigation.navigate('Support')} />
          <MenuRow icon="info-outline" label="عن Kilix" onPress={() => navigation.navigate('About')} />
        </Section>

        <Section title="السياسات القانونية">
          <MenuRow icon="gavel" label="السياسات القانونية" onPress={() => setLegalSheetVisible(true)} />
          <MenuRow icon="language" label="سياسة الخصوصية العامة" sub="فتح رابط السياسة خارج التطبيق" onPress={() => Linking.openURL(ENV.PRIVACY_POLICY_URL)} />
        </Section>

        <Pressable style={styles.deleteAccountRow} onPress={handleDeleteAccount}>
          <TText style={styles.deleteAccountText}>حذف الحساب</TText>
          <MaterialIcons name="delete-outline" size={20} color={colors.error} />
        </Pressable>

        <Pressable style={styles.logout} onPress={handleLogout}>
          <TText style={styles.logoutText}>تسجيل الخروج</TText>
          <MaterialIcons name="logout" size={20} color={colors.error} />
        </Pressable>
        </View>
      </ScrollView>

      <LegalPoliciesSheet
        visible={legalSheetVisible}
        onClose={() => setLegalSheetVisible(false)}
        onSelect={handleSelectLegalOption}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerGradient: { paddingTop: spacing.sm, paddingBottom: spacing.lg, paddingHorizontal: spacing.md, borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  topBarDot: { position: 'absolute', top: -2, left: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orangeVibrant },
  topBarBrand: { ...typography.titleMd, color: colors.orangeVibrant, fontFamily: 'Cairo_800ExtraBold' },
  profileHeader: { alignItems: 'center', gap: 4 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.orangeVibrant, borderWidth: 4, borderColor: colors.orangeVibrant, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.white, fontSize: 32, fontWeight: '800' },
  verifiedDot: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.headlineMobile, color: colors.charcoalText, marginTop: spacing.sm },
  phone: { ...typography.bodySm, color: colors.onSurfaceVariant },
  statsRow: { flexDirection: 'row-reverse', backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.surfaceContainerLow, padding: spacing.md, marginTop: spacing.lg, ...cardShadow.level1 },
  statCard: { flex: 1, alignItems: 'center', gap: 2 },
  statCardDivider: { borderRightWidth: 1, borderLeftWidth: 1, borderColor: colors.surfaceContainerLow },
  statValue: { ...typography.priceLg, fontSize: 18, color: colors.orangeVibrant },
  statLabel: { fontSize: 10, color: colors.outline, textAlign: 'center', marginTop: 2 },
  referralCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.surfaceContainerLow, padding: spacing.md, marginTop: -spacing.lg, gap: spacing.md, ...cardShadow.level1 },
  referralTitle: { color: colors.charcoalText, fontFamily: 'Cairo_700Bold', fontSize: 15, textAlign: 'right' },
  referralSub: { color: colors.onSurfaceVariant, fontSize: 12, textAlign: 'right', marginTop: 2 },
  shareBtn: { backgroundColor: colors.orangeVibrant, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full },
  shareBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  sectionTitle: { ...typography.bodySm, color: colors.outline, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'right' },
  card: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden' },
  menuRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  menuLabel: { ...typography.bodyLg, color: colors.charcoalText, textAlign: 'right' },
  menuSub: { ...typography.bodySm, color: colors.outline, textAlign: 'right' },
  languageRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  languageOptions: { flexDirection: 'row-reverse', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  languageChip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.white },
  languageChipActive: { backgroundColor: colors.orangeVibrant, borderColor: colors.orangeVibrant },
  languageChipText: { color: colors.charcoalText, fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  languageChipTextActive: { color: colors.white },
  badge: { backgroundColor: colors.orangeVibrant, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  deleteAccountRow: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.surfaceContainerLow,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteAccountText: {
    ...typography.bodyMd,
    color: colors.error,
    fontWeight: '700',
  },
  logout: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xl, padding: spacing.md },
  logoutText: { color: colors.error, fontFamily: 'Cairo_700Bold', fontSize: 15 },
});