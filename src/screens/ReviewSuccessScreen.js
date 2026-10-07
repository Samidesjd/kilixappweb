import { TText } from '../context/LanguageContext';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import PrimaryButton from '../components/PrimaryButton';
import { colors, spacing, typography, radius, cardShadow } from '../theme/theme';

// شاشة تأكيد نجاح إرسال التقييم — تظهر بعد تأكيد الإرسال في OrderReviewScreen.
export default function ReviewSuccessScreen({ navigation, route }) {
  const { couponAwarded = false, couponAmount = 500 } = route?.params || {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.wrap}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="check" size={48} color={colors.white} />
        </View>
        <TText style={styles.title}>تم ترك تعليقك بنجاح.</TText>

        {couponAwarded ? (
          <View style={styles.couponCard}>
            <MaterialIcons name="card-giftcard" size={28} color={colors.orangeVibrant} />
            <TText style={styles.couponText}>
              تم إضافة كوبون خصم بقيمة {couponAmount.toLocaleString('en-US')} دج إلى حسابك.
            </TText>
          </View>
        ) : null}

        <PrimaryButton
          title="العودة للرئيسية"
          variant="navy"
          onPress={() => navigation.navigate('Main', { screen: 'الرئيسية' })}
          style={{ marginTop: spacing.xl }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  iconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headlineLg, color: colors.charcoalText, marginTop: spacing.lg, textAlign: 'center' },
  couponCard: {
    ...cardShadow.level1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  couponText: { ...typography.bodyLg, fontWeight: '700', color: colors.charcoalText, textAlign: 'right', flex: 1 },
});
