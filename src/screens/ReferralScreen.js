import { TText } from '../context/LanguageContext';
import React, { useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { useAuth } from '../context/AuthContext';


function StatCard({ icon, value, label }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <MaterialIcons name={icon} size={20} color={colors.charcoalText} />
      </View>
      <TText style={styles.statValue}>{value}</TText>
      <TText style={styles.statLabel}>{label}</TText>
    </View>
  );
}

function EmptyState({ onRefresh }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIllustration}>
        <MaterialIcons name="card-giftcard" size={56} color={colors.outline} />
      </View>
      <TText style={styles.emptyText}>لا توجد عروض إحالة متاحة حاليًا.</TText>
      <Pressable style={styles.refreshBtn} onPress={onRefresh}>
        <MaterialIcons name="refresh" size={18} color={colors.white} />
        <TText style={styles.refreshBtnText}>تحديث</TText>
      </Pressable>
    </View>
  );
}

export default function ReferralScreen({ navigation }) {
  const { user } = useAuth();
  const scrollRef = useRef(null);
  const statsY = useRef(0);

  const stats = { totalInvitations: '—', successfulReferrals: '—', pendingReferrals: '—', totalRewardsEarned: '—' };

  const handleShare = async () => {
    try {
      await Share.share({ message: `معرفي في Kilix: ${user?.user_code || '—'}` });
    } catch (e) {
      // تجاهل الإلغاء
    }
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(user?.user_code || '');
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(user?.user_code || '');
  };

  const handleRefresh = () => undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── الترويسة المخصصة مع سهم الرجوع في أقصى اليسار ── */}
      <View style={styles.header}>
        <TText style={styles.headerTitle}>عروض الإحالة</TText>
        <Pressable 
          style={styles.backBtn} 
          onPress={() => navigation?.goBack()} 
          hitSlop={12}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.charcoalText} />
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
        <TText style={styles.subtitle}>ادعُ أصدقاءك واكسب مكافآت حصرية</TText>

        {true ? (
          <EmptyState onRefresh={handleRefresh} />
        ) : null}

        <View onLayout={(e) => { statsY.current = e.nativeEvent.layout.y; }}>
          <TText style={styles.sectionTitle}>إحصائياتي في الإحالة</TText>
          <View style={styles.statsGrid}>
            <StatCard icon="send" value={stats.totalInvitations} label="إجمالي الدعوات" />
            <StatCard icon="check-circle-outline" value={stats.successfulReferrals} label="إحالات ناجحة" />
            <StatCard icon="hourglass-empty" value={stats.pendingReferrals} label="إحالات معلّقة" />
            <StatCard icon="payments" value={stats.totalRewardsEarned} label="إجمالي المكافآت" />
          </View>
        </View>

        <TText style={styles.sectionTitle}>رابط الإحالة الخاص بك</TText>
        <View style={styles.linkCard}>
          <View style={styles.linkRow}>
            <TText style={styles.linkLabel}>الكود</TText>
            <TText style={styles.linkValue} numberOfLines={1}>{user?.user_code || '—'}</TText>
          </View>
          <View style={styles.linkRow}>
            <TText style={styles.linkLabel}>الرابط</TText>
            <TText style={styles.linkValue} numberOfLines={1}>{user?.user_code ? `Kilix:${user.user_code}` : '—'}</TText>
          </View>
          <View style={styles.linkActions}>
            <Pressable style={styles.linkActionBtn} onPress={handleCopyLink}>
              <MaterialIcons name="content-copy" size={16} color={colors.charcoalText} />
              <TText style={styles.linkActionText}>نسخ الرابط</TText>
            </Pressable>
            <Pressable style={styles.linkActionBtn} onPress={handleCopyCode}>
              <MaterialIcons name="content-copy" size={16} color={colors.charcoalText} />
              <TText style={styles.linkActionText}>نسخ الكود</TText>
            </Pressable>
            <Pressable style={[styles.linkActionBtn, styles.linkActionPrimary]} onPress={handleShare}>
              <MaterialIcons name="share" size={16} color={colors.white} />
              <TText style={[styles.linkActionText, { color: colors.white }]}>مشاركة</TText>
            </Pressable>
          </View>
        </View>

        <TText style={styles.sectionTitle}>سجل الإحالات</TText>
        <View style={styles.historyCard}>
          <TText style={styles.emptyHistoryText}>نظام الإحالات غير مفعل في مخطط قاعدة البيانات الحالي.</TText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerLow,
  },
  headerTitle: {
    ...typography.titleMd,
    fontSize: 17,
    color: colors.charcoalText,
    textAlign: 'center',
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },

  subtitle: { ...typography.bodyLg, color: colors.onSurfaceVariant, textAlign: 'right', marginBottom: spacing.md, marginTop: spacing.sm },

  sectionTitle: { ...typography.titleMd, fontSize: 16, color: colors.charcoalText, textAlign: 'right', marginTop: spacing.lg, marginBottom: spacing.sm },

  // Stats grid
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, width: '47%', alignItems: 'center', gap: 4 },
  statIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.infoContainer, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { ...typography.priceLg, fontSize: 18, color: colors.charcoalText },
  statLabel: { fontSize: 11, color: colors.outline, textAlign: 'center' },

  // Referral link card
  linkCard: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  linkRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 10, gap: spacing.sm },
  linkLabel: { fontSize: 12, color: colors.outline, fontWeight: '700' },
  linkValue: { ...typography.dataMono, color: colors.charcoalText, flex: 1, textAlign: 'left' },
  linkActions: { flexDirection: 'row-reverse', gap: spacing.sm, marginTop: 4 },
  linkActionBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.md, paddingVertical: 10 },
  linkActionPrimary: { backgroundColor: colors.navyDeep, borderColor: colors.navyDeep },
  linkActionText: { fontSize: 12, fontWeight: '700', color: colors.charcoalText },

  // History
  historyCard: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden' },
  historyRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  historyAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  historyAvatarText: { fontWeight: '800', color: colors.charcoalText },
  historyName: { ...typography.bodySm, fontWeight: '700', color: colors.charcoalText, textAlign: 'right' },
  historyDate: { fontSize: 11, color: colors.outline, textAlign: 'right', marginTop: 2 },
  historyStatusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  historyStatusText: { fontSize: 10, fontWeight: '800' },
  emptyHistoryText: { padding: spacing.md, color: colors.outline, textAlign: 'right' },
  historyReward: { fontSize: 12, fontWeight: '800', color: colors.charcoalText },

  // Empty state
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 1.5, gap: spacing.md },
  emptyIllustration: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...typography.bodyLg, color: colors.outline, textAlign: 'center' },
  refreshBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: colors.orangeVibrant, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  refreshBtnText: { color: colors.white, fontFamily: 'Cairo_700Bold', fontSize: 13 },
});