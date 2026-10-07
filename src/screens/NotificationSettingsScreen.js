import { TText } from '../context/LanguageContext';
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { getNotificationSettings, updateNotificationSettings } from '../services/Userservice';

function ToggleRow({ title, sub, value, onChange }) {
  return (
    <View style={styles.row}>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.orangeVibrant, false: colors.outlineVariant }}
        thumbColor={colors.white}
      />
      <View style={{ flex: 1 }}>
        <TText style={styles.rowTitle}>{title}</TText>
        {sub ? <TText style={styles.rowSub}>{sub}</TText> : null}
      </View>
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const [all, setAll] = useState(true);
  const [shipping, setShipping] = useState(true);
  const [inventory, setInventory] = useState(true);
  const [messages, setMessages] = useState(true);
  const [ratings, setRatings] = useState(true);
  const [payments, setPayments] = useState(true);
  const [system, setSystem] = useState(true);
  const [quietHours, setQuietHours] = useState(false);

  const save = useCallback(async (patch) => {
    if (!user?.auth_id) return;
    const result = await updateNotificationSettings(user.auth_id, patch);
    if (!result.success) throw new Error(result.error || result.message || 'تعذر حفظ الإعدادات');
  }, [user?.auth_id]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.auth_id) return;
      const result = await getNotificationSettings(user.auth_id);
      if (!active || !result.success || !result.settings) return;
      const x = result.settings;
      setAll(!!x.enabled);
      setShipping(!!x.order_notifications);
      setInventory(!!x.inventory_notifications);
      setMessages(!!x.message_notifications);
      setRatings(!!x.rating_notifications);
      setPayments(!!x.payment_notifications);
      setSystem(!!x.system_notifications);
      setQuietHours(!!x.quiet_hours_enabled);
    })();
    return () => { active = false; };
  }, [user?.auth_id]);

  const setAllAndSave = async (value) => {
    setAll(value);
    try { await save({ enabled: value }); } catch (_) {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="إعدادات الإشعارات" />
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <View style={styles.heroCard}>
          <Switch
            value={all}
            onValueChange={setAllAndSave}
            trackColor={{ true: colors.orangeVibrant, false: colors.surfaceDim }}
            thumbColor={colors.white}
          />
          <View style={{ flex: 1 }}>
            <TText style={styles.heroTitle}>تفعيل كافة الإشعارات</TText>
            <TText style={styles.heroSub}>تحكم في جميع تنبيهات التطبيق بضغطة واحدة</TText>
          </View>
        </View>

        <TText style={styles.sectionTitle}>الطلبات والشحن</TText>
        <View style={styles.card}>
          <ToggleRow title="تحديثات الشحن" sub="تغيير حالة الطلبية وحالتها" value={shipping} onChange={async (v) => { setShipping(v); try { await save({ order_notifications: v }); } catch (_) {} }} />
          <ToggleRow title="إدارة المخزون" sub="تنبيهات نفاد المخزون" value={inventory} onChange={async (v) => { setInventory(v); try { await save({ inventory_notifications: v }); } catch (_) {} }} />
        </View>

        <TText style={styles.sectionTitle}>المحادثات والتقييمات</TText>
        <View style={styles.card}>
          <ToggleRow title="الرسائل" sub="رسائل المحادثات الخاصة وتأكيدات الطلبات" value={messages} onChange={async (v) => { setMessages(v); try { await save({ message_notifications: v }); } catch (_) {} }} />
          <ToggleRow title="التقييمات والمتابعات" sub="تقييمات المنتجات والمتابعون الجدد" value={ratings} onChange={async (v) => { setRatings(v); try { await save({ rating_notifications: v }); } catch (_) {} }} />
          <ToggleRow title="تنبيهات الدفع" sub="تسجيل الدفعات والفواتير" value={payments} onChange={async (v) => { setPayments(v); try { await save({ payment_notifications: v }); } catch (_) {} }} />
          <ToggleRow title="تنبيهات النظام" sub="التحديثات العامة للحساب" value={system} onChange={async (v) => { setSystem(v); try { await save({ system_notifications: v }); } catch (_) {} }} />
        </View>

        <TText style={styles.sectionTitle}>ساعات الهدوء</TText>
        <View style={styles.card}>
          <ToggleRow title={'وضع "عدم الإزعاج"'} sub="كتم الإشعارات في أوقات محددة" value={quietHours} onChange={async (v) => { setQuietHours(v); try { await save({ quiet_hours_enabled: v }); } catch (_) {} }} />
          {quietHours ? (
            <View style={styles.timeRow}>
              <View style={styles.timeBox}><TText style={styles.timeLabel}>من الساعة</TText><TText style={styles.timeValue}>10:00 م</TText></View>
              <View style={styles.timeBox}><TText style={styles.timeLabel}>إلى الساعة</TText><TText style={styles.timeValue}>08:00 ص</TText></View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heroCard: { ...cardShadow.level1, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceContainerLow, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
  heroTitle: { color: colors.charcoalText, fontFamily: 'Cairo_700Bold', fontSize: 15, textAlign: 'right' },
  heroSub: { color: colors.onSurfaceVariant, fontSize: 12, textAlign: 'right', marginTop: 2 },
  sectionTitle: { ...typography.bodySm, color: colors.outline, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'right' },
  card: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.lg, marginBottom: spacing.lg, overflow: 'hidden' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  rowTitle: { ...typography.bodyLg, fontWeight: '700', color: colors.charcoalText, textAlign: 'right' },
  rowSub: { ...typography.bodySm, color: colors.outline, textAlign: 'right', marginTop: 2 },
  timeRow: { flexDirection: 'row-reverse', gap: spacing.md, padding: spacing.md },
  timeBox: { flex: 1, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  timeLabel: { fontSize: 11, color: colors.outline },
  timeValue: { ...typography.bodyLg, fontWeight: '700', color: colors.charcoalText, marginTop: 2 },
});
