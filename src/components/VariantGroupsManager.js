import { TText } from '../context/LanguageContext';
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import VariantGroupCard from './VariantGroupCard';
import { isVariantCombinationAvailable } from '../constants/variants';

// يدير قائمة "مجموعات الاختيار" (كمية + خيارات مستقلة) لنفس المنتج، مثل ما
// تفعل منصات التجارة العالمية (Alibaba/1688) عند طلب كميات مختلفة بمواصفات مختلفة
// لنفس المنتج ضمن نفس الطلبية. مكوّن متحكَّم فيه بالكامل (controlled):
// الحالة (groups) تُدار في الشاشة الأم، وهذا المكوّن فقط يعرضها وينادي المعالجات.
export default function VariantGroupsManager({
  product,
  variantGroups,
  groups,
  onAddGroup,
  onRemoveGroup,
  onChangeQty,
  onSelectVariant,
  showErrors,
  currency,
}) {
  const totalQty = groups.reduce((sum, g) => sum + g.qty, 0);
  const totalPrice = groups.reduce((sum, g) => sum + g.qty * (product?.price || 0), 0);
  const completeCount = groups.filter(
    (g) =>
      variantGroups.every((vg) => !!g.variants[vg.key]) &&
      isVariantCombinationAvailable(product, g.variants)
  ).length;

  return (
    <View style={styles.wrap}>
      {groups.map((g, index) => (
        <VariantGroupCard
          key={g.id}
          index={index}
          product={product}
          variantGroups={variantGroups}
          value={g}
          onChangeQty={(qty) => onChangeQty(g.id, qty)}
          onSelectVariant={(groupKey, optionKey) => onSelectVariant(g.id, groupKey, optionKey)}
          onRemove={() => onRemoveGroup(g.id)}
          canRemove={groups.length > 1}
          showErrors={showErrors}
          currency={currency}
        />
      ))}

      <Pressable style={styles.addGroupBtn} onPress={onAddGroup}>
        <MaterialIcons name="add-circle-outline" size={20} color={colors.orangeVibrant} />
        <TText style={styles.addGroupText}>إضافة مجموعة أخرى</TText>
      </Pressable>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <TText style={styles.summaryLabel}>عدد المجموعات</TText>
          <TText style={styles.summaryValue}>
            {completeCount} / {groups.length} مكتملة
          </TText>
        </View>
        <View style={styles.summaryRow}>
          <TText style={styles.summaryLabel}>إجمالي الكمية</TText>
          <TText style={styles.summaryValue}>{totalQty.toLocaleString('en-US')} قطعة</TText>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <TText style={styles.summaryTotalLabel}>السعر الإجمالي</TText>
          <TText style={styles.summaryTotalValue}>
            {totalPrice.toLocaleString('en-US')} {currency}
          </TText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  addGroupBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.orangeVibrant,
    borderStyle: 'dashed',
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    backgroundColor: '#FFF6EF',
  },
  addGroupText: { fontWeight: '700', color: colors.orangeVibrant, ...typography.bodySm },
  summaryCard: {
    ...cardShadow.level1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { ...typography.bodySm, color: colors.outline },
  summaryValue: { ...typography.bodySm, fontWeight: '700', color: colors.charcoalText },
  summaryTotalRow: { paddingTop: spacing.sm, marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  summaryTotalLabel: { ...typography.titleMd, fontSize: 15, color: colors.charcoalText },
  summaryTotalValue: { ...typography.priceLg, fontSize: 20, color: colors.orangeVibrant },
});
