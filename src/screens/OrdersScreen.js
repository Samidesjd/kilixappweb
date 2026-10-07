import { TText, LTextInput, useLocalizedAlert } from '../context/LanguageContext';
import React, { useState, useMemo } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, Image,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useData } from '../context/DataContext';
import { ORDER_STATUS } from '../constants/orderStatus';
import StatusBadge from '../components/StatusBadge';

const PALETTE = {
  bg:            '#F4F5F7',
  cardBg:        '#FFFFFF',
  subtleBox:     '#F8F9FA',
  textPrimary:   '#1E2022',
  textSecondary: '#6C757D',
  textMuted:     '#ADB5BD',
  border:        '#E9ECEF',
  orangePrimary: '#F25F00',
  orangeSoft:    '#FFF4EC',
};

// التبويبات: الكل / قيد الانتظار / قيد الشحن / مكتمل
const ORDER_TABS = [
  { key: 'all',                      label: 'الكل' },
  { key: ORDER_STATUS.PENDING,        label: 'قيد الانتظار' },
  { key: ORDER_STATUS.SHIPPING,       label: 'قيد الشحن' },
  { key: ORDER_STATUS.COMPLETED,      label: 'مكتمل' },
];

const MONTHS_AR = [
  'يناير','فبراير','مارس','أبريل','ماي','جوان',
  'جويلية','أوت','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];

function formatOrderDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`;
}

// ── دوال مساعدة موحّدة لفحص الحالة ──────────────────────────────────────────
// تقبل القيم الإنجليزية الجديدة والمرادفات القديمة الموجودة في Firestore

function isPendingStatus(status) {
  return String(status || '').toLowerCase() === ORDER_STATUS.PENDING;
}

function isShippingStatus(status) {
  return String(status || '').toLowerCase() === ORDER_STATUS.SHIPPING;
}

function isCompletedStatus(status) {
  return String(status || '').toLowerCase() === ORDER_STATUS.COMPLETED;
}

export default function OrdersScreen({ navigation }) {
  const showLocalizedAlert = useLocalizedAlert();
  const { orders, loading, loadOrders, loadMoreOrders, confirmReceipt } = useData();
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let list = [...orders];

    // فلترة حسب التبويب
    if (tab === ORDER_STATUS.PENDING) {
      list = list.filter((o) => isPendingStatus(o.status));
    } else if (tab === ORDER_STATUS.SHIPPING) {
      list = list.filter((o) => isShippingStatus(o.status));
    } else if (tab === ORDER_STATUS.COMPLETED) {
      list = list.filter((o) => isCompletedStatus(o.status));
    }
    // tab === 'all' → يعرض جميع الحالات بدون فلترة

    // فلترة نصية
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (o) =>
          (o.title || '').toLowerCase().includes(q) ||
          (o.id   || '').toLowerCase().includes(q),
      );
    }

    return list;
  }, [orders, tab, query]);

  const handleProductPress = (order) => {
    navigation.navigate('ProductDetail', {
      product: {
        id: order.productId,
        storeId: order.storeId,
        title: order.title,
        price: order.unitPrice,
        image: order.image,
        images: order.image ? [order.image] : [],
        category: order.category,
        rating: 0,
      },
    });
  };

  // ── تأكيد الاستلام ────────────────────────────────────────────────────────
  // لا يُحدَّث status هنا — التحديث يحدث داخل submitOrderReview في OrderReviewScreen
  // بعد إرسال التقييم فعلياً. نمرّر الطلب كما هو لشاشة التقييم.
  const handleConfirmReceived = async (e, order) => {
    e?.stopPropagation?.();
    if (!order?.id) return;
    try {
      const updatedOrder = await confirmReceipt(order.id);
      navigation.navigate('OrderReview', { order: updatedOrder });
      await loadOrders();
    } catch (error) {
      showLocalizedAlert('تعذر تأكيد الاستلام', error?.message || 'يرجى المحاولة مرة أخرى.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* الترويسة */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <MaterialIcons name="arrow-forward" size={22} color={PALETTE.textPrimary} />
        </Pressable>
        <TText style={styles.title}>طلباتي</TText>
        <View style={{ width: 38 }} />
      </View>

      {/* البحث */}
      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={18} color={PALETTE.textMuted} />
        <LTextInput
          style={styles.searchInput}
          placeholder="ابحث في طلباتك"
          placeholderTextColor={PALETTE.textMuted}
          value={query}
          onChangeText={setQuery}
          textAlign="right"
        />
      </View>

      {/* التبويبات */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {ORDER_TABS.map((t) => {
            const isActive = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <TText style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {t.label}
                </TText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* قائمة الطلبات */}
      <ScrollView
        onScroll={({ nativeEvent }) => { const { layoutMeasurement, contentOffset, contentSize } = nativeEvent; if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 400) void loadMoreOrders(); }}
        scrollEventThrottle={250}
        contentContainerStyle={styles.scrollList}
        refreshControl={
          <RefreshControl
            refreshing={loading.orders}
            onRefresh={loadOrders}
            colors={[PALETTE.orangePrimary]}
            tintColor={PALETTE.orangePrimary}
          />
        }
      >
        {loading.orders && orders.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={PALETTE.orangePrimary} />
            <TText style={styles.emptyText}>جارٍ تحميل طلباتك...</TText>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="inventory-2" size={36} color={PALETTE.textMuted} />
            <TText style={styles.emptyText}>لا توجد طلبات في هذا القسم</TText>
          </View>
        ) : (
          filtered.map((o) => (
            <Pressable key={o.id} style={styles.card} onPress={() => handleProductPress(o)}>

              {/* أعلى البطاقة */}
              <View style={styles.cardTop}>
                <View style={styles.iconBox}>
                  {o.image ? (
                    <Image source={{ uri: o.image }} style={styles.orderProductImage} resizeMode="cover" />
                  ) : (
                    <MaterialIcons name="image" size={22} color={PALETTE.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTopRow}>
                    <TText style={styles.category}>{o.categoryLabel}</TText>
                    <StatusBadge status={o.status} />
                  </View>
                  <TText style={styles.name} numberOfLines={1}>{o.title}</TText>
                  <TText style={styles.qtyText}>
                    الكمية: {(o.qty || 0).toLocaleString('ar')} {o.qtyUnit || 'قطعة'}
                  </TText>
                </View>
              </View>

              {/* أسفل البطاقة */}
              <View style={styles.bottomRow}>
                <View>
                  <TText style={styles.dateLabel}>تاريخ الطلب</TText>
                  <TText style={styles.dateValue}>{formatOrderDate(o.date)}</TText>
                </View>
                <TText style={styles.price}>
                  {(o.total || 0).toLocaleString('en-US')}{' '}
                  <TText style={styles.currency}>{o.currency}</TText>
                </TText>
              </View>

              {/* زر "تأكيد استلام الطلب" — يظهر فقط عند حالة shipping */}
              {isShippingStatus(o.status) ? (
                <Pressable
                  style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
                  onPress={(e) => handleConfirmReceived(e, o)}
                >
                  <MaterialIcons name="check-circle-outline" size={16} color="#fff" style={{ marginLeft: 4 }} />
                  <TText style={styles.btnPrimaryText}>تأكيد استلام الطلب</TText>
                </Pressable>
              ) : null}

            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: PALETTE.bg },
  header:        { height: 48, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 4 },
  backBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: PALETTE.cardBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: PALETTE.border },
  title:         { fontSize: 18, fontWeight: '700', color: PALETTE.textPrimary, textAlign: 'center' },
  searchRow:     { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, backgroundColor: PALETTE.cardBg, borderRadius: 12, borderWidth: 1, borderColor: PALETTE.border, paddingHorizontal: 12, height: 38 },
  searchInput:   { flex: 1, fontSize: 12, color: PALETTE.textPrimary, paddingVertical: 0 },
  tabsWrapper:   { marginBottom: 8, paddingHorizontal: 16 },
  tabsRow:       { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tab:           { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 18, backgroundColor: PALETTE.cardBg, borderWidth: 1, borderColor: PALETTE.border },
  tabActive:     { backgroundColor: PALETTE.textPrimary, borderColor: PALETTE.textPrimary },
  tabText:       { fontSize: 12, color: PALETTE.textSecondary, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  scrollList:    { paddingHorizontal: 16, paddingBottom: 20, gap: 12, flexGrow: 1 },
  card:          { backgroundColor: PALETTE.cardBg, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: PALETTE.border },
  cardTop:       { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  iconBox:       { width: 44, height: 44, borderRadius: 10, backgroundColor: PALETTE.subtleBox, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  orderProductImage: { width: '100%', height: '100%' },
  iconEmoji:     { fontSize: 20 },
  cardTopRow:    { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  category:      { fontSize: 11, color: PALETTE.textMuted, fontWeight: '500' },
  name:          { fontSize: 13, fontWeight: '700', color: PALETTE.textPrimary, textAlign: 'right', marginTop: 2 },
  qtyText:       { fontSize: 11, color: PALETTE.textSecondary, textAlign: 'right', marginTop: 2 },
  bottomRow:     { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, borderTopWidth: 1, borderTopColor: PALETTE.border, paddingTop: 8 },
  dateLabel:     { fontSize: 10, color: PALETTE.textMuted, textAlign: 'right' },
  dateValue:     { fontSize: 11, color: PALETTE.textSecondary, fontWeight: '500', textAlign: 'right', marginTop: 1 },
  price:         { fontSize: 15, fontWeight: '800', color: PALETTE.orangePrimary },
  currency:      { fontSize: 11, fontWeight: '600' },
  empty:         { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyText:     { fontSize: 13, color: PALETTE.textMuted },
  btnPrimary:    { height: 40, backgroundColor: PALETTE.orangePrimary, borderRadius: 20, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 4 },
  btnPressed:    { opacity: 0.88 },
  btnPrimaryText:{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
