import { TText } from '../context/LanguageContext';
import React from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, sizes } from '../theme/theme';
import { VARIANT_GROUPS } from '../constants/variants';

/**
 * CartItemCard — compact professional e-commerce card.
 * Layout mirrors the AliExpress reference:
 *   [checkbox] [image] | [title] [variants] [price row] [qty + total]
 * All existing props/callbacks (onIncrease, onDecrease, onRemove) preserved.
 * New props: selected (bool), onToggleSelect (fn), onProductPress (fn) — optional, gracefully ignored if not passed.
 */
// React.memo: عناصر السلة تُعاد رسمها بكثرة عند تغيير كمية عنصر واحد فقط،
// التغليف هنا يمنع إعادة رسم بقية العناصر التي لم تتغيّر
const CartItemCard = React.memo(function CartItemCard({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  selected = false,
  onToggleSelect,
  onProductPress,
}) {
  const product = item?.product || {
    id: item?.product_id,
    title: item?.product_snapshot?.title || item?.title || '',
    image: item?.product_snapshot?.imageUrl || item?.imageUrl || null,
    images: item?.product?.images || (item?.product_snapshot?.imageUrl ? [item.product_snapshot.imageUrl] : []),
    price: Number(item?.unit_price || 0),
    oldPrice: item?.product?.oldPrice,
    currency: item?.product?.currency || item?.currency || 'دج',
    supplier: item?.product?.supplier,
  };
  const variants = item?.variants || item?.selected_options || {};
  const qty = Number(item?.qty ?? item?.quantity ?? 1);
  const unitPrice = Number(item?.unitPrice ?? item?.unit_price ?? product?.price ?? 0);

  // Build human-readable variant labels
  const variantLabels = Object.entries(variants || {})
    .map(([groupKey, optKey]) => {
      const group = VARIANT_GROUPS[groupKey];
      const opt = group?.options.find((o) => o.key === optKey);
      return opt ? opt.label : null;
    })
    .filter(Boolean);

  const hasDiscount = !!product?.oldPrice && product.oldPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;
  const totalPrice = unitPrice * qty;
  const currency = product?.currency || 'دج';

  return (
    <View style={s.card}>
      {/* ── Top row: checkbox · image · info ───────────────────────── */}
      <Pressable 
        style={s.topRow}
        onPress={() => onProductPress?.(item?.product)}
        disabled={!onProductPress}
      >
        {/* Selection checkbox */}
        <Pressable
          onPress={onToggleSelect}
          hitSlop={10}
          style={s.checkboxWrap}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
        >
          <View style={[s.checkbox, selected && s.checkboxChecked]}>
            {selected && (
              <MaterialIcons name="check" size={13} color={colors.white} />
            )}
          </View>
        </Pressable>

        {/* Product image */}
        <View style={s.imageWrap}>
          {hasDiscount ? (
            <View style={s.saleBadge}>
              <TText style={s.saleBadgeText}>-{discountPct}%</TText>
            </View>
          ) : null}
          <Image
            source={{ uri: product?.image }}
            style={s.image}
            resizeMode="cover"
          />
        </View>

        {/* Product info column */}
        <View style={s.infoCol}>

          {/* Title */}
          <TText style={s.title} numberOfLines={2}>{product?.title}</TText>

          {/* Variants chip */}
          {variantLabels.length > 0 ? (
            <View style={s.variantChip}>
              <TText style={s.variantText} numberOfLines={1}>
                {variantLabels.join(' · ')}
              </TText>
              <MaterialIcons name="chevron-left" size={13} color={colors.outline} />
            </View>
          ) : null}

          {/* Price row */}
          <View style={s.priceRow}>
            <TText style={s.currentPrice}>
              {unitPrice.toLocaleString('en-US')}
              <TText style={s.priceCurrency}> {currency}</TText>
            </TText>
            {hasDiscount ? (
              <TText style={s.oldPrice}>
                {product.oldPrice.toLocaleString('en-US')}
              </TText>
            ) : null}
          </View>

          {/* Discount label */}
          {hasDiscount ? (
            <TText style={s.discountLabel}>تخفيض · -{discountPct}% الآن</TText>
          ) : null}

          {/* Bottom row: qty control · total · delete */}
          <View style={s.bottomRow}>
            {/* Qty stepper */}
            <View style={s.stepper}>
              <Pressable onPress={onIncrease} hitSlop={8} style={s.stepBtn}>
                <MaterialIcons name="add" size={15} color={colors.charcoalText} />
              </Pressable>
              <TText style={s.stepQty}>{qty}</TText>
              <Pressable
                onPress={onDecrease}
                hitSlop={8}
                style={[s.stepBtn, qty <= 1 && s.stepBtnDisabled]}
                disabled={qty <= 1}
              >
                <MaterialIcons
                  name="remove"
                  size={15}
                  color={qty <= 1 ? colors.outlineVariant : colors.charcoalText}
                />
              </Pressable>
            </View>

            {/* Total price */}
            <TText style={s.totalPrice}>
              {totalPrice.toLocaleString('en-US')} {currency}
            </TText>

            {/* Delete */}
            <Pressable onPress={onRemove} hitSlop={10} style={s.deleteBtn}>
              <MaterialIcons name="delete-outline" size={18} color={colors.outline} />
            </Pressable>
          </View>

        </View>
      </Pressable>

      {/* Shipping line (shown only when product has moq or supplier info) */}
      {product?.supplier ? (
        <View style={s.shippingRow}>
          <MaterialIcons name="local-shipping" size={11} color={colors.outline} />
          <TText style={s.shippingText}>
            شحن عبر {product.supplier}
          </TText>
        </View>
      ) : null}
    </View>
  );
});

export default CartItemCard;

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  // Top row
  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },

  // Checkbox
  checkboxWrap: {
    paddingTop: 2,
    width: 24,
    alignItems: 'center',
  },
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

  // Image
  imageWrap: {
    width: 90,
    height: 90,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  saleBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderBottomLeftRadius: radius.sm,
  },
  saleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
  },

  // Info column
  infoCol: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    lineHeight: 19,
    color: colors.charcoalText,
    textAlign: 'right',
  },

  // Variant chip
  variantChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 2,
  },
  variantText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    maxWidth: 120,
  },

  // Price
  priceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  currentPrice: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 15,
    color: colors.orangeVibrant,
    lineHeight: 20,
  },
  priceCurrency: {
    fontSize: 11,
    color: colors.orangeVibrant,
  },
  oldPrice: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 11,
    color: colors.outline,
    textDecorationLine: 'line-through',
  },
  discountLabel: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '700',
    textAlign: 'right',
  },

  // Bottom row
  bottomRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },

  // Stepper
  stepper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.sm,
    overflow: 'hidden',
    height: 28,
  },
  stepBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLow,
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepQty: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 13,
    color: colors.charcoalText,
    minWidth: 28,
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  // Total
  totalPrice: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 14,
    color: colors.charcoalText,
    flex: 1,
    textAlign: 'center',
  },

  // Delete
  deleteBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Shipping
  shippingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainerHighest,
  },
  shippingText: {
    fontSize: 11,
    color: colors.outline,
    textAlign: 'right',
  },
});
