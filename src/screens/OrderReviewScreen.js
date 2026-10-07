import { TText, LTextInput } from '../context/LanguageContext';
import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { useData } from '../context/DataContext';
import { useCart } from '../context/CartContext';

// شاشة تقييم الطلب — تفتح بعد الضغط على "تأكيد استلام الطلب" في OrdersScreen.
// عند إرسال التقييم:
//   1. يتم تحديث حالة الطلب في 'orders' إلى status:'completed'
//   2. يُضاف التقييم إلى مستند المنتج في 'products/{productId}' مع إعادة حساب المتوسط
//   3. يُمنح الزبون كوبون 500 دج إذا أضاف تعليقاً
export default function OrderReviewScreen({ navigation, route }) {
  const { submitOrderReview } = useData();
  const { removeProductFromCart } = useCart();
  const order = route?.params?.order;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = rating > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // await ضروري: submitOrderReview async تكتب في Firestore
      const result = await submitOrderReview(order?.id, { rating, comment }, undefined, order?.productId);
      if (!result?.success) throw new Error(result?.error || 'تعذر إرسال التقييم');

      // إزالة هذا المنتج من السلة بعد اكتمال الطلب.
      if (order?.productId) await removeProductFromCart(order.productId);

      navigation.replace('ReviewSuccess', {
        couponAwarded: !!result.coupon,
        couponAmount: Number(result.coupon?.amount || 0),
      });
    } catch (err) {
      if (__DEV__) console.error('[OrderReviewScreen] handleSubmit error:', err);
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="تقييم الطلب" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {/* بطاقة معلومات الطلب */}
          <View style={styles.card}>
            <View style={styles.iconBox}>
              <TText style={styles.iconEmoji}>{order?.emoji || '📦'}</TText>
            </View>
            <TText style={styles.orderTitle}>{order?.title || 'طلبك'}</TText>
            <TText style={styles.orderSub}>
              تم تسليم طلبك بنجاح. شاركنا رأيك لمساعدتنا على التحسّن.
            </TText>
          </View>

          {/* التقييم بالنجوم */}
          <View style={styles.card}>
            <TText style={styles.sectionLabel}>ما تقييمك للطلب؟</TText>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={8} style={styles.starBtn}>
                  <MaterialIcons
                    name={n <= rating ? 'star' : 'star-border'}
                    size={36}
                    color={n <= rating ? colors.orangeVibrant : colors.outlineVariant}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {/* التعليق النصي */}
          <View style={styles.card}>
            <TText style={styles.sectionLabel}>أضف تعليقك (اختياري)</TText>
            <LTextInput
              style={styles.commentInput}
              placeholder="اكتب تعليقك عن المنتج وتجربة الشراء..."
              placeholderTextColor={colors.outline}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={5}
              textAlign="right"
              textAlignVertical="top"
            />
          </View>

          {/* بانر الكوبون */}
          <View style={styles.rewardBanner}>
            <MaterialIcons name="local-offer" size={22} color={colors.orangeVibrant} />
            <TText style={styles.rewardText}>
              احصل على كوبون خصم بقيمة 500 دج عند ترك تعليق.
            </TText>
          </View>

          <PrimaryButton
            title="إرسال التقييم"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  card: {
    ...cardShadow.level1,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  iconBox:      { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  iconEmoji:    { fontSize: 28 },
  orderTitle:   { ...typography.titleMd, color: colors.charcoalText, textAlign: 'center' },
  orderSub:     { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.xs },
  sectionLabel: { ...typography.bodyLg, fontWeight: '700', color: colors.charcoalText, textAlign: 'right', alignSelf: 'stretch', marginBottom: spacing.sm },
  starsRow:     { flexDirection: 'row-reverse', justifyContent: 'center', gap: spacing.xs },
  starBtn:      { padding: 2 },
  commentInput: { width: '100%', minHeight: 110, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.md, padding: spacing.md, ...typography.bodyLg, color: colors.onSurface },
  rewardBanner: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningContainer, borderRadius: radius.lg, padding: spacing.md },
  rewardText:   { ...typography.bodySm, color: colors.secondary, fontWeight: '700', textAlign: 'right', flex: 1 },
});
