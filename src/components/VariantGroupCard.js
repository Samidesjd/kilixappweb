import { TText } from '../context/LanguageContext';
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import VariantSelector from './VariantSelector';
import { getDisabledOptionKeys, isVariantCombinationAvailable } from '../constants/variants';

// بطاقة واحدة داخل "مجموعات الاختيار" في صفحة تفاصيل المنتج.
// كل بطاقة = كمية مستقلة + خيارات مستقلة (لون/مقاس/سعة تخزين... حسب المنتج)،
// تماماً كما تفعل منصات مثل Alibaba عند إضافة عدة أسطر بمواصفات مختلفة لنفس المنتج.
const VariantGroupCard = React.memo(function VariantGroupCard({
  index,
  product,
  variantGroups,
  value, // { id, qty, variants }
  onChangeQty,
  onSelectVariant,
  onRemove,
  canRemove,
  showErrors,
  currency,
}) {
  const isComplete = variantGroups.every((g) => !!value.variants[g.key]);
  const fullyOutOfStock = isComplete && !isVariantCombinationAvailable(product, value.variants);
  const lineTotal = (product?.price || 0) * value.qty;

  const disabledKeysByGroup = {};
  variantGroups.forEach((g) => {
    disabledKeysByGroup[g.key] = getDisabledOptionKeys(product, g.key, variantGroups, value.variants);
  });

  return (
    <View style={[styles.card, showErrors && !isComplete && styles.cardError]}>
      <View style={styles.headerRow}>
        <TText style={styles.headerTitle}>المجموعة {index + 1}</TText>
        <View style={styles.headerActions}>
          {isComplete ? (
            <View style={styles.completeBadge}>
              <MaterialIcons name="check-circle" size={13} color={colors.success} />
              <TText style={styles.completeBadgeText}>مكتملة</TText>
            </View>
          ) : (
            <View style={styles.pendingBadge}>
              <TText style={styles.pendingBadgeText}>غير مكتملة</TText>
            </View>
          )}
          {canRemove ? (
            <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
              <MaterialIcons name="delete-outline" size={18} color={colors.error} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {variantGroups.length > 0 ? (
        <VariantSelector
          groups={variantGroups}
          selected={value.variants}
          onSelect={onSelectVariant}
          disabledKeysByGroup={disabledKeysByGroup}
          showErrors={showErrors}
        />
      ) : (
        <TText style={styles.noVariants}>هذا المنتج لا يحتوي على خيارات إضافية</TText>
      )}

      {fullyOutOfStock ? (
        <View style={styles.oosBanner}>
          <MaterialIcons name="error-outline" size={14} color={colors.error} />
          <TText style={styles.oosBannerText}>هذه التوليفة غير متوفرة حالياً، جرّب خياراً آخر</TText>
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <View>
          <TText style={styles.label}>الكمية</TText>
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepperBtn} hitSlop={6} onPress={() => onChangeQty(value.qty + 1)}>
              <MaterialIcons name="add" size={16} color={colors.charcoalText} />
            </Pressable>
            <View style={styles.qtyValueBox}>
              <TText style={styles.qtyValueText}>{value.qty}</TText>
            </View>
            <Pressable
              style={[styles.stepperBtn, value.qty <= 1 && styles.stepperBtnDisabled]}
              hitSlop={6}
              disabled={value.qty <= 1}
              onPress={() => onChangeQty(Math.max(1, value.qty - 1))}
            >
              <MaterialIcons name="remove" size={16} color={value.qty <= 1 ? colors.outlineVariant : colors.charcoalText} />
            </Pressable>
          </View>
        </View>

        <View style={styles.lineTotalBox}>
          <TText style={styles.label}>سعر هذه المجموعة</TText>
          <TText style={styles.lineTotalText}>
            {lineTotal.toLocaleString('en-US')} {currency}
          </TText>
        </View>
      </View>
    </View>
  );
});

export default VariantGroupCard;

const styles = StyleSheet.create({
  card: {
    ...cardShadow.level1,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardError: { borderWidth: 1.5, borderColor: colors.error },
  headerRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { ...typography.titleMd, fontSize: 15, color: colors.charcoalText },
  headerActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  completeBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successContainer,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  completeBadgeText: { fontSize: 11, fontWeight: '700', color: colors.success },
  pendingBadge: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: colors.outline },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorContainer,
  },
  noVariants: { ...typography.bodySm, color: colors.outline, textAlign: 'right' },
  oosBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.errorContainer,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  oosBannerText: { fontSize: 12, color: colors.onErrorContainer, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  footerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainerLow,
  },
  label: { ...typography.bodySm, fontSize: 12, color: colors.outline, textAlign: 'right', marginBottom: spacing.xs },
  stepperRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  stepperBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepperBtnDisabled: { opacity: 0.4 },
  qtyValueBox: {
    minWidth: 44,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.xs,
  },
  qtyValueText: { ...typography.titleMd, fontSize: 16, color: colors.charcoalText },
  lineTotalBox: { alignItems: 'flex-end' },
  lineTotalText: { ...typography.priceLg, fontSize: 16, color: colors.orangeVibrant },
});
