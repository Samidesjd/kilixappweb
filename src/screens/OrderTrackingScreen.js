import { TText } from '../context/LanguageContext';
import React from 'react';
import { SafeAreaView, ScrollView, View, Image, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors as THEME } from '../theme/theme';

const STATUS = {
  pending: { label: 'قيد الانتظار', icon: 'schedule' },
  shipping: { label: 'قيد الشحن', icon: 'local-shipping' },
  delivered: { label: 'تم الاستلام', icon: 'inventory-2' },
  completed: { label: 'مكتمل', icon: 'check-circle' },
  out_of_stock: { label: 'نفد المخزون', icon: 'error-outline' },
  cancelled: { label: 'ملغى', icon: 'cancel' },
};

const STEPS = ['pending', 'shipping', 'delivered', 'completed'];

function StepProgressBar({ status }) {
  const idx = STEPS.indexOf(status);
  const percentage = status === 'out_of_stock' || status === 'cancelled' ? 0 : Math.round(((Math.max(idx, 0) + 1) / STEPS.length) * 100);
  return (
    <View style={progressStyles.wrapper}>
      <View style={progressStyles.textRow}>
        <TText style={progressStyles.percentText}>{percentage}%</TText>
        <TText style={progressStyles.labelText}>تقدم الطلبية</TText>
      </View>
      <View style={progressStyles.track}>
        <View style={[progressStyles.fill, { width: `${percentage}%` }]} />
      </View>
    </View>
  );
}

function TrackingTimeline({ status }) {
  const current = STEPS.indexOf(status);
  return (
    <View style={tlStyles.container}>
      {STEPS.map((step, idx) => {
        const done = current >= idx;
        const active = current === idx;
        const meta = STATUS[step];
        return (
          <View key={step} style={tlStyles.row}>
            <View style={tlStyles.lineCol}>
              <View style={[tlStyles.dot, done && tlStyles.dotDone, active && tlStyles.dotActive]}>
                <MaterialIcons name={meta.icon} size={13} color={done ? '#FFFFFF' : THEME.textMuted} />
              </View>
              {idx < STEPS.length - 1 && <View style={[tlStyles.connector, idx < current && tlStyles.connectorDone]} />}
            </View>
            <View style={[tlStyles.content, idx < STEPS.length - 1 && { paddingBottom: 22 }]}>
              <TText style={[tlStyles.title, !done && { color: THEME.textMuted }, active && { color: '#FF6B00', fontWeight: '800' }]}>{meta.label}</TText>
              <TText style={[tlStyles.sub, !done && { color: THEME.textMuted }]}>الحالة الفعلية المسجلة في الطلبية</TText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ProductItem({ order }) {
  const status = order?.status || 'pending';
  const meta = STATUS[status] || STATUS.pending;
  return (
    <View style={styles.card}>
      <View style={styles.productHeader}>
        {order?.image ? <Image source={{ uri: order.image }} style={styles.productImg} /> : <View style={[styles.productImg, styles.productImgPlaceholder]}><MaterialIcons name="image" size={30} color={THEME.textMuted} /></View>}
        <View style={styles.productMainInfo}>
          <TText style={styles.productTitle} numberOfLines={2}>{order?.title || 'الطلبية'}</TText>
          <TText style={styles.productMeta}>الكمية: {order?.qty || 0} {order?.qtyUnit || 'قطعة'} • {Number(order?.total || 0).toLocaleString('ar-DZ')} دج</TText>
          <View style={styles.badgeRow}>
            <View style={styles.statusBadge}>
              <MaterialIcons name={meta.icon} size={13} color="#FF6B00" />
              <TText style={styles.statusBadgeText}>{meta.label}</TText>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.dropdownContent}>
        <View style={styles.divider} />
        <StepProgressBar status={status} />
        <View style={styles.metaBox}>
          <View style={styles.metaItem}>
            <TText style={styles.metaLabel}>رقم الطلب</TText>
            <TText style={styles.metaValueText}>{order?.id || '—'}</TText>
          </View>
          <View style={styles.metaItem}>
            <TText style={styles.metaLabel}>طريقة التوصيل</TText>
            <TText style={styles.metaValueText}>{order?.deliveryType === 'office' ? 'مكتب' : 'المنزل'}</TText>
          </View>
        </View>
        {(status === 'out_of_stock' || status === 'cancelled') ? null : <TrackingTimeline status={status} />}
      </View>
    </View>
  );
}

export default function OrderTrackingScreen({ route }) {
  const order = route?.params?.order;
  const orders = order ? [order] : [];
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="تتبع الطلبية" />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {order ? (
          <>
            <View style={styles.topSummaryBar}>
              <View>
                <TText style={styles.summaryLabel}>رقم الطلب</TText>
                <TText style={styles.summaryVal}>{order.id}</TText>
              </View>
              <View style={styles.topBadge}>
                <MaterialIcons name="inventory-2" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                <TText style={styles.topBadgeText}>طلبية واحدة</TText>
              </View>
            </View>
            <TText style={styles.pageSectionTitle}>الحالة المسجلة</TText>
            {orders.map((item) => <ProductItem key={item.id} order={item} />)}
          </>
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="local-shipping" size={48} color={THEME.textMuted} />
            <TText style={styles.emptyTitle}>لا توجد طلبية للتتبع</TText>
            <TText style={styles.emptyText}>افتح التتبع من سجل الطلبات لعرض الحالة الفعلية.</TText>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  topSummaryBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.navyPrimary,
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: THEME.navyPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  summaryLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    textAlign: 'right',
  },
  summaryVal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    textAlign: 'right',
  },
  topBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  topBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pageSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
    textAlign: 'right',
    marginBottom: 12,
  },
  
  // Card Accordion Style
  card: {
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: THEME.navyPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardActive: {
    borderColor: '#FF6B00',
    borderWidth: 1.5,
  },
  productHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  productImg: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: THEME.navySoft,
  },
  productMainInfo: {
    flex: 1,
    marginRight: 12,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
    textAlign: 'right',
  },
  productMeta: {
    fontSize: 12,
    color: THEME.textSecondary,
    textAlign: 'right',
    marginTop: 3,
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    marginTop: 6,
  },
  statusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: THEME.orangeSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6B00',
  },
  expandIconBox: {
    paddingLeft: 4,
  },

  // Dropdown Content
  dropdownContent: {
    marginTop: 14,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.border,
    marginBottom: 14,
  },
  metaBox: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: THEME.navySoft,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  metaItem: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontSize: 10,
    color: THEME.textSecondary,
  },
  metaValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
    textAlign: 'right',
    marginBottom: 14,
  },
});

const progressStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  textRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  percentText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF6B00',
  },
  track: {
    height: 6,
    backgroundColor: THEME.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 3,
  },
});

const tlStyles = StyleSheet.create({
  container: {
    paddingRight: 4,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
  },
  lineCol: {
    alignItems: 'center',
    marginLeft: 12,
    width: 24,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.navySoft,
    borderWidth: 2,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dotDone: {
    backgroundColor: THEME.navyPrimary,
    borderColor: THEME.navyPrimary,
  },
  dotActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
    shadowColor: '#FF6B00',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: THEME.border,
    marginVertical: -2,
  },
  connectorDone: {
    backgroundColor: THEME.navyPrimary,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textPrimary,
    textAlign: 'right',
  },
  time: {
    fontSize: 10,
    color: THEME.textMuted,
  },
  sub: {
    fontSize: 11,
    color: THEME.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
});