import { TText } from '../context/LanguageContext';
import React from 'react';
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing, radius, typography } from '../theme/theme';
import { useData } from '../context/DataContext';

const TYPE_META = {
  order:   { icon: 'local-shipping',   bg: '#E8F0FE', fg: '#1A56DB' },
  payment: { icon: 'payments',          bg: '#FEF3E2', fg: '#B45309' },
  message: { icon: 'chat-bubble-outline', bg: '#F0FDF4', fg: '#15803D' },
  system:  { icon: 'info-outline',      bg: colors.surfaceContainer, fg: colors.onSurfaceVariant },
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return 'الآن';
  if (hours < 24) return `${hours}س`;
  const days = Math.floor(hours / 24);
  return `${days}ي`;
}

function NotificationItem({ item, onPress, isLast }) {
  const meta = TYPE_META[item.type] || TYPE_META.system;
  return (
    <Pressable
      style={[styles.item, !isLast && styles.itemBorder, !item.read && styles.itemUnread]}
      onPress={() => onPress(item.id)}
      android_ripple={{ color: colors.surfaceContainer }}
    >
      {/* Unread indicator */}
      {!item.read ? <View style={styles.unreadDot} /> : null}

      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
        <MaterialIcons name={meta.icon} size={18} color={meta.fg} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <TText style={styles.time}>{timeAgo(item.date)}</TText>
          <TText style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </TText>
        </View>
        <TText style={styles.body} numberOfLines={2}>{item.body}</TText>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen({ navigation }) {
  const { notifications, loading, loadNotifications, loadMoreNotifications, markNotificationRead, markAllNotificationsRead, unreadNotificationsCount } = useData();
  const unreadCount = unreadNotificationsCount;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="الإشعارات"
        rightAction={
          <Pressable onPress={markAllNotificationsRead} hitSlop={10} style={styles.markAllBtn}>
            <TText style={styles.markAllText}>قراءة الكل</TText>
          </Pressable>
        }
      />

      {/* Unread count badge */}
      {unreadCount > 0 ? (
        <View style={styles.countBar}>
          <View style={styles.countPill}>
            <TText style={styles.countText}>{unreadCount} غير مقروء</TText>
          </View>
        </View>
      ) : null}

      <FlatList
        data={notifications}
        onEndReached={loadMoreNotifications}
        onEndReachedThreshold={0.5}
        keyExtractor={(i) => i.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={loading.notifications}
            onRefresh={loadNotifications}
            colors={[colors.orangeVibrant]}
          />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <NotificationItem
            item={item}
            onPress={markNotificationRead}
            isLast={index === notifications.length - 1}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="notifications-none" size={32} color={colors.outlineVariant} />
            </View>
            <TText style={styles.emptyTitle}>لا توجد إشعارات</TText>
            <TText style={styles.emptyBody}>ستظهر هنا إشعارات طلباتك ومراسلاتك</TText>
          </View>
        }
        ListFooterComponent={
          <Pressable
            style={styles.settingsRow}
            onPress={() => navigation.navigate('NotificationSettings')}
          >
            <MaterialIcons name="chevron-left" size={18} color={colors.outlineVariant} />
            <TText style={styles.settingsLabel}>إعدادات الإشعارات</TText>
            <View style={styles.settingsIconWrap}>
              <MaterialIcons name="settings" size={16} color={colors.onSurfaceVariant} />
            </View>
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  markAllBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  markAllText: { ...typography.caption, color: colors.navyDeep, fontWeight: '700' },

  countBar: {
    flexDirection: 'row-reverse',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  countPill: {
    backgroundColor: colors.infoContainer,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  countText: { ...typography.caption, color: colors.info, fontWeight: '700' },

  listContent: { flexGrow: 1 },

  // Notification item
  item: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    position: 'relative',
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  itemUnread: { backgroundColor: colors.surfaceContainerLowest },

  unreadDot: {
    position: 'absolute',
    left: spacing.xs,
    top: 18,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.orangeVibrant,
  },

  iconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  content: { flex: 1 },
  topRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.bodySm, fontWeight: '600', color: colors.charcoalText, flexShrink: 1, textAlign: 'right' },
  titleUnread: { fontWeight: '700' },
  time: { ...typography.caption, color: colors.outline, flexShrink: 0 },
  body: { ...typography.caption, color: colors.onSurfaceVariant, textAlign: 'right', marginTop: 2, lineHeight: 17 },

  // Empty state
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl * 2, gap: spacing.sm },
  emptyIcon: {
    width: 64, height: 64, borderRadius: radius.xl,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { ...typography.bodyLg, color: colors.charcoalText, fontWeight: '700' },
  emptyBody: { ...typography.bodySm, color: colors.outline, textAlign: 'center' },

  // Settings footer row
  settingsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainerLow,
    marginTop: spacing.sm,
    backgroundColor: colors.white,
  },
  settingsIconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsLabel: { ...typography.bodySm, fontWeight: '600', color: colors.charcoalText, flex: 1, textAlign: 'right' },
});
