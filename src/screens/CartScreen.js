import { TText } from '../context/LanguageContext';
import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import CartItemCard from '../components/CartItemCard';
import { colors, spacing, radius, typography, cardShadow, sizes } from '../theme/theme';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import GuestAuthModal from '../components/GuestAuthModal';

// ─── Helper: group items by supplier/seller (excluding Guangzhou Textile Group) ────────────────────────────────
function groupBySeller(items) {
  const map = {};
  items.forEach((item) => {
    let seller = item.product?.supplier || 'متاجر متنوعة';
    // استبعاد وعزل أي نص يتعلق بـ Guangzhou Textile Group
    if (seller.toLowerCase().includes('guangzhou')) {
      seller = 'متاجر متنوعة';
    }
    if (!map[seller]) map[seller] = [];
    map[seller].push(item);
  });
  return Object.entries(map); // [ [sellerName, [items...]], ... ]
}

// ─── Empty state ────────────────────────────────────────────────────────────
function EmptyCart({ onBrowse }) {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIconCircle}>
        <MaterialIcons name="shopping-cart" size={40} color={colors.outlineVariant} />
      </View>
      <TText style={s.emptyTitle}>سلتك فارغة</TText>
      <TText style={s.emptySub}>أضف منتجات من الصفحة الرئيسية لتظهر هنا</TText>
      <Pressable style={s.emptyBtn} onPress={onBrowse}>
        <TText style={s.emptyBtnText}>تصفح المنتجات</TText>
      </Pressable>
    </View>
  );
}

// ─── Seller group header ────────────────────────────────────────────────────
function SellerHeader({ name, allSelected, onToggleAll }) {
  return (
    <View style={s.sellerHeader}>
      <Pressable onPress={onToggleAll} hitSlop={10} style={s.sellerCheckWrap}>
        <View style={[s.checkbox, allSelected && s.checkboxChecked]}>
          {allSelected && (
            <MaterialIcons name="check" size={13} color={colors.white} />
          )}
        </View>
      </Pressable>
      <MaterialIcons name="storefront" size={15} color={colors.secondary} />
      <TText style={s.sellerName} numberOfLines={1}>{name}</TText>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────
export default function CartScreen({ navigation }) {
  const { items, updateQty, removeItem, itemCount } = useCart();
  const { user } = useAuth();
  const [guestAuthVisible, setGuestAuthVisible] = useState(false);

  // ✅ دالة التنقل إلى صفحة تفاصيل المنتج
  const handleProductPress = (product) => {
    if (product?.id) {
      navigation.navigate('ProductDetail', { 
        product: {
          id: product.id,
          title: product.title,
          image: product.image,
          images: product.images || (product.image ? [product.image] : []),
          price: product.price,
          currency: product.currency || 'دج',
          supplier: product.supplier,
          category: product.category,
          categoryLabel: product.categoryLabel,
          rating: product.rating || 0,
          moq: product.moq,
          emoji: product.emoji,
          description: product.description,
          variants: product.variants,
        }
      });
    }
  };

  // Selection state: Set of selected lineIds
  const getItemKey = (item) => item?.lineId || item?.id || `${item?.product_id || 'product'}:${JSON.stringify(item?.selected_options || {})}`;
  const [selectedIds, setSelectedIds] = useState(() => new Set(items.map(getItemKey)));

  const toggleItem = (lineId) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(lineId) ? next.delete(lineId) : next.add(lineId);
      return next;
    });

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(getItemKey(item)));

  const toggleAll = () =>
    setSelectedIds(
      allSelected ? new Set() : new Set(items.map(getItemKey))
    );

  const grouped = useMemo(() => groupBySeller(items), [items]);

  // Empty cart
  if (items.length === 0) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.headerIconBtn}>
            <MaterialIcons name="arrow-forward" size={24} color={colors.charcoalText} />
          </Pressable>
          <TText style={s.headerTitle}>سلة التسوق</TText>
          <View style={s.headerActions} />
        </View>
        <EmptyCart onBrowse={() => navigation.navigate('Main', { screen: 'الرئيسية' })} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.headerIconBtn}>
          <MaterialIcons name="arrow-forward" size={24} color={colors.charcoalText} />
        </Pressable>
        <TText style={s.headerTitle}>
          سلة التسوق
          <TText style={s.headerCount}> ({items.length})</TText>
        </TText>
        <View style={s.headerActions}>
          <Pressable hitSlop={10} style={s.headerIconBtn}>
            <MaterialIcons name="favorite-border" size={22} color={colors.charcoalText} />
          </Pressable>
          <Pressable
            hitSlop={10}
            style={s.headerIconBtn}
            onPress={() => {
              // Remove all selected items
              selectedIds.forEach((lid) => removeItem(lid));
              setSelectedIds(new Set());
            }}
          >
            <MaterialIcons name="delete-outline" size={22} color={colors.charcoalText} />
          </Pressable>
        </View>
      </View>

      {/* ── Select-all bar ────────────────────────────────────────── */}
      <View style={s.selectAllBar}>
        <Pressable onPress={toggleAll} hitSlop={8} style={s.selectAllLeft}>
          <View style={[s.checkbox, allSelected && s.checkboxChecked]}>
            {allSelected && <MaterialIcons name="check" size={13} color={colors.white} />}
          </View>
          <TText style={s.selectAllText}>تحديد الكل</TText>
        </Pressable>
        <TText style={s.selectAllCount}>
          {selectedIds.size} / {items.length} منتج
        </TText>
      </View>

      {/* ── Product list ──────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {grouped.map(([seller, sellerItems]) => {
          const sellerIds = sellerItems.map((i) => i.lineId);
          const allSellerSelected = sellerIds.every((id) => selectedIds.has(id));
          const toggleSellerAll = () => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (allSellerSelected) {
                sellerIds.forEach((id) => next.delete(id));
              } else {
                sellerIds.forEach((id) => next.add(id));
              }
              return next;
            });
          };

          return (
            <View key={seller} style={s.sellerGroup}>
              {/* Seller header */}
              <SellerHeader
                name={seller}
                allSelected={allSellerSelected}
                onToggleAll={toggleSellerAll}
              />

              {/* Items in this seller group */}
              {sellerItems.map((item, idx) => (
                <View key={getItemKey(item)}>
                  <CartItemCard
                    item={item}
                    selected={selectedIds.has(getItemKey(item))}
                    onToggleSelect={() => toggleItem(getItemKey(item))}
                    onIncrease={() => updateQty(getItemKey(item), Number(item.qty ?? item.quantity ?? 1) + 1)}
                    onDecrease={() => updateQty(getItemKey(item), Number(item.qty ?? item.quantity ?? 1) - 1)}
                    onRemove={() => {
                      removeItem(item.lineId);
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(getItemKey(item));
                        return next;
                      });
                    }}
                    onProductPress={handleProductPress}
                  />
                  {idx < sellerItems.length - 1 && <View style={s.itemDivider} />}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {/* ── Guest auth prompt ─────────────────────────────────────────────── */}
      <GuestAuthModal
        visible={guestAuthVisible}
        onClose={() => setGuestAuthVisible(false)}
        onSignIn={() => {
          setGuestAuthVisible(false);
          navigation.navigate('Welcome');
        }}
        onCreateAccount={() => {
          setGuestAuthVisible(false);
          navigation.navigate('Welcome');
        }}
        reason="order"
      />
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceContainerHighest },

  // Header
  header: {
    height: sizes.headerHeight,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    ...cardShadow.level1,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: colors.charcoalText,
    flex: 1,
    textAlign: 'center',
  },
  headerCount: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: colors.outline,
  },
  headerActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
  },

  // Select-all bar
  selectAllBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHighest,
  },
  selectAllLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectAllText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.charcoalText,
  },
  selectAllCount: {
    fontSize: 12,
    color: colors.outline,
    fontFamily: 'Cairo_400Regular',
  },

  // Shared checkbox
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.orangeVibrant,
    borderColor: colors.orangeVibrant,
  },

  // Seller group
  sellerGroup: {
    backgroundColor: colors.white,
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.surfaceContainerHighest,
  },
  sellerHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHighest,
  },
  sellerCheckWrap: {
    padding: 2,
  },
  sellerName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.charcoalText,
    flex: 1,
    textAlign: 'right',
  },

  // Item separator inside a seller group
  itemDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHighest,
    marginHorizontal: spacing.md,
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.charcoalText,
  },
  emptySub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.navyDeep,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: 13,
  },
  emptyBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.white,
  },
});