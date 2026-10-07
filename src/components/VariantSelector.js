import { TText } from '../context/LanguageContext';
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme/theme';

// يعرض مجموعات الخيارات الديناميكية لمنتج معيّن (يُبنى من src/constants/variants.js).
// لا يعرض أبداً مجموعة غير متوفرة للمنتج، ويدعم أي عدد من المجموعات بدون تعديل الواجهة.
//
// disabledKeysByGroup: { [groupKey]: Set<optionKey> } — خيارات غير متوفرة (نفدت الكمية)
// تظهر معطّلة وغير قابلة للضغط بدل إخفائها، ليبقى المستخدم يعرف أن الخيار موجود لكن غير متوفر حالياً.
// showErrors: يبرز بحد أحمر أي مجموعة إلزامية لم يتم اختيارها بعد (تستعمل عند محاولة الحفظ).
export default function VariantSelector({ groups, selected, onSelect, disabledKeysByGroup, showErrors }) {
  if (!groups || groups.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {groups.map((group) => {
        const isMissing = showErrors && !selected[group.key];
        const disabledSet = disabledKeysByGroup?.[group.key];
        return (
          <View key={group.key} style={styles.group}>
            <View style={styles.groupLabelRow}>
              <TText style={[styles.groupLabel, isMissing && styles.groupLabelError]}>{group.label}</TText>
              {isMissing ? <TText style={styles.requiredNote}>مطلوب</TText> : null}
            </View>

            {group.type === 'color' ? (
              <View style={styles.colorRow}>
                {group.options.map((opt) => {
                  const active = selected[group.key] === opt.key;
                  const disabled = disabledSet?.has(opt.key);
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => !disabled && onSelect(group.key, opt.key)}
                      style={[styles.colorItem, disabled && styles.itemDisabled]}
                      hitSlop={4}
                      disabled={disabled}
                    >
                      <View
                        style={[
                          styles.colorDot,
                          { backgroundColor: opt.hex },
                          opt.hex === '#FFFFFF' && styles.colorDotBorder,
                          active && styles.colorDotActive,
                          disabled && styles.colorDotDisabled,
                        ]}
                      >
                        {active ? (
                          <MaterialIcons
                            name="check"
                            size={16}
                            color={isLight(opt.hex) ? colors.charcoalText : colors.white}
                          />
                        ) : null}
                        {disabled ? <View style={styles.strikeLine} /> : null}
                      </View>
                      <TText style={[styles.colorLabel, disabled && styles.textDisabled]}>{opt.label}</TText>
                      {disabled ? <TText style={styles.oosLabel}>نفد المخزون</TText> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.chipRow}>
                {group.options.map((opt) => {
                  const active = selected[group.key] === opt.key;
                  const disabled = disabledSet?.has(opt.key);
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => !disabled && onSelect(group.key, opt.key)}
                      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
                      disabled={disabled}
                    >
                      <TText style={[styles.chipText, active && styles.chipTextActive, disabled && styles.textDisabled]}>
                        {opt.label}
                      </TText>
                      {disabled ? <TText style={styles.oosLabelChip}>غير متوفر</TText> : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function isLight(hex) {
  if (!hex) return false;
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  group: { gap: spacing.sm },
  groupLabelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  groupLabel: { fontWeight: '700', color: colors.charcoalText, textAlign: 'right', ...typography.bodySm },
  groupLabelError: { color: colors.error },
  requiredNote: { fontSize: 11, color: colors.error, fontWeight: '700' },
  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.mistGray,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  chipActive: { backgroundColor: colors.navyDeep, borderColor: colors.navyDeep },
  chipDisabled: { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, opacity: 0.5 },
  chipText: { fontWeight: '700', color: colors.charcoalText, fontSize: 13 },
  chipTextActive: { color: colors.white },
  oosLabelChip: { fontSize: 9, color: colors.error, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  colorRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.md },
  colorItem: { alignItems: 'center', gap: 4, width: 60 },
  itemDisabled: { opacity: 0.9 },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  colorDotBorder: { borderColor: colors.outlineVariant },
  colorDotActive: { borderColor: colors.orangeVibrant },
  colorDotDisabled: { opacity: 0.35 },
  strikeLine: {
    position: 'absolute',
    width: 44,
    height: 2,
    backgroundColor: colors.error,
    transform: [{ rotate: '45deg' }],
  },
  colorLabel: { fontSize: 10, color: colors.onSurfaceVariant, textAlign: 'center' },
  textDisabled: { color: colors.outline },
  oosLabel: { fontSize: 9, color: colors.error, fontWeight: '700' },
});
