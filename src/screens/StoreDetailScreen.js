import { TText, useLocalizedAlert } from '../context/LanguageContext';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { getStoreDataService, getStoreProducts, getStoreProductCount, isFollowingStore, followStoreService, unfollowStoreService, openStoreChat } from '../services/storeService';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';

const money = (value) => Number(value || 0).toLocaleString('en-US');

export default function StoreDetailScreen({ navigation, route }) {
  const showLocalizedAlert = useLocalizedAlert();
  const { user } = useAuth();
  const { loadConversations } = useData();
  const storeId = route?.params?.storeId || null;
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyFollow, setBusyFollow] = useState(false);
  const [productCount, setProductCount] = useState(0);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const productLoadingRef = React.useRef(false);

  const load = useCallback(async (refresh = false) => {
    if (!storeId) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const [storeResult, productRows, total, isFollowed] = await Promise.all([
        getStoreDataService(storeId),
        getStoreProducts(storeId, { limit: 40, offset: 0 }),
        getStoreProductCount(storeId),
        user?.auth_id ? isFollowingStore(storeId, user.auth_id) : Promise.resolve(false),
      ]);
      if (!storeResult.success) throw new Error(storeResult.message || 'المتجر غير موجود');
      setStore(storeResult.data);
      setProducts((productRows || []).filter((p) => p.is_active !== false));
      setProductCount(Number(total) || 0);
      setHasMoreProducts((productRows || []).length < Number(total || 0));
      setFollowing(!!isFollowed);
    } catch (error) {
      showLocalizedAlert('تعذر تحميل المتجر', error?.message || 'حاول مرة أخرى.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId, user?.auth_id]);

  const loadMoreProducts = useCallback(async () => {
    if (!storeId || productLoadingRef.current || loadingMoreProducts || !hasMoreProducts) return;
    productLoadingRef.current = true;
    setLoadingMoreProducts(true);
    try {
      const page = await getStoreProducts(storeId, { limit: 40, offset: products.length });
      const visible = (page || []).filter((p) => p.is_active !== false);
      setProducts((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...visible.filter((item) => !seen.has(item.id))];
      });
      setHasMoreProducts(products.length + visible.length < productCount);
    } catch (error) {
      if (__DEV__) console.error('[StoreDetailScreen] load more products error:', error);
    } finally {
      setLoadingMoreProducts(false);
      productLoadingRef.current = false;
    }
  }, [storeId, loadingMoreProducts, hasMoreProducts, products.length, productCount]);

  useEffect(() => { void load(false); }, [load]);

  const handleToggleFollow = async () => {
    if (!user?.auth_id) return showLocalizedAlert('تسجيل الدخول مطلوب', 'سجل دخولك لمتابعة المتجر.');
    if (!store?.id || busyFollow) return;
    setBusyFollow(true);
    try {
      if (following) {
        await unfollowStoreService(store.id);
        setFollowing(false);
        setStore((prev) => prev ? { ...prev, followers_count: Math.max(0, Number(prev.followers_count || 0) - 1) } : prev);
      } else {
        await followStoreService(store.id);
        setFollowing(true);
        setStore((prev) => prev ? { ...prev, followers_count: Number(prev.followers_count || 0) + 1 } : prev);
      }
    } catch (error) {
      showLocalizedAlert('تعذر تحديث المتابعة', error?.message || 'حاول مرة أخرى.');
    } finally {
      setBusyFollow(false);
    }
  };

  const handleMessage = async () => {
    if (!user?.auth_id) return showLocalizedAlert('تسجيل الدخول مطلوب', 'سجل دخولك لمراسلة صاحب المتجر.');
    if (!store?.id) return;
    try {
      const chat = await openStoreChat(store.id);
      const otherUserId = chat?.participant_1_id === user.auth_id ? chat?.participant_2_id : chat?.participant_1_id;
      await loadConversations();
      navigation.navigate('Chat', {
        conversationId: chat.id,
        otherUserId,
        title: store.store_name || 'المتجر',
        chat,
      });
    } catch (error) {
      showLocalizedAlert('تعذر فتح المحادثة', error?.message || 'حاول مرة أخرى.');
    }
  };

  const storeTitle = store?.store_name || route?.params?.storeName || 'المتجر';

  const header = useMemo(() => (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <MaterialIcons name="arrow-forward" size={22} color={colors.charcoalText} />
        </Pressable>
        <TText style={styles.headerTitle} numberOfLines={1}>{storeTitle}</TText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.storeCard}>
        <View style={styles.storeLogo}>
          {store?.logo_url ? <Image source={{ uri: store.logo_url }} style={styles.storeLogoImage} /> : <MaterialIcons name="storefront" size={32} color={colors.orangeVibrant} />}
        </View>
        <TText style={styles.storeName}>{storeTitle}</TText>
        <TText style={styles.storeDescription}>{store?.description || 'متجر Kilix'}</TText>
        <View style={styles.statsRow}>
          <View style={styles.stat}><TText style={styles.statValue}>{Number(store?.followers_count || 0).toLocaleString('ar-DZ')}</TText><TText style={styles.statLabel}>متابع</TText></View>
          <View style={styles.stat}><TText style={styles.statValue}>{productCount.toLocaleString('ar-DZ')}</TText><TText style={styles.statLabel}>منتج</TText></View>
          <View style={styles.stat}><TText style={styles.statValue}>{Number(store?.average_rating || 0).toFixed(1)}</TText><TText style={styles.statLabel}>تقييم</TText></View>
        </View>
        <View style={styles.actionsRow}>
          <Pressable onPress={handleMessage} style={[styles.actionButton, styles.outlineButton]}>
            <MaterialIcons name="chat" size={18} color={colors.charcoalText} /><TText style={styles.outlineText}>مراسلة</TText>
          </Pressable>
          <Pressable disabled={busyFollow} onPress={handleToggleFollow} style={[styles.actionButton, styles.primaryButton]}>
            <MaterialIcons name={following ? 'person-remove' : 'person-add'} size={18} color={colors.white} /><TText style={styles.primaryText}>{following ? 'إلغاء المتابعة' : 'متابعة'}</TText>
          </Pressable>
        </View>
      </View>

      <TText style={styles.sectionTitle}>منتجات المتجر</TText>
    </View>
  ), [navigation, store, storeTitle, productCount, following, busyFollow]);

  if (loading && !store) {
    return <SafeAreaView style={styles.container} edges={['top']}><View style={styles.center}><ActivityIndicator size="large" color={colors.orangeVibrant} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        onEndReached={loadMoreProducts}
        onEndReachedThreshold={0.55}
        ListFooterComponent={loadingMoreProducts ? <View style={{ paddingVertical: 18 }}><ActivityIndicator size="small" color={colors.orangeVibrant} /></View> : null}
        ListEmptyComponent={<View style={styles.empty}><MaterialIcons name="inventory-2" size={42} color={colors.outlineVariant} /><TText style={styles.emptyText}>لا توجد منتجات منشورة حالياً.</TText></View>}
        renderItem={({ item }) => {
          const image = Array.isArray(item.images) && item.images[0] ? item.images[0] : null;
          return (
            <Pressable style={styles.productCard} onPress={() => navigation.navigate('ProductDetail', { product: item })}>
              <View style={styles.productImageWrap}>
                {image ? <Image source={{ uri: image }} style={styles.productImage} resizeMode="cover" /> : <MaterialIcons name="image-not-supported" size={34} color={colors.outlineVariant} />}
              </View>
              <TText style={styles.productTitle} numberOfLines={2}>{item.title}</TText>
              <TText style={styles.productPrice}>{money(item.price)} <TText style={styles.currency}>دج</TText></TText>
              <View style={styles.ratingRow}><MaterialIcons name="star" size={14} color={colors.orangeVibrant} /><TText style={styles.rating}>{Number(item.average_rating || 0).toFixed(1)} ({Number(item.total_reviews || 0)})</TText></View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { height: 52, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.outlineVariant },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.titleMd, color: colors.charcoalText },
  storeCard: { margin: spacing.md, padding: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, ...cardShadow.level1, alignItems: 'center' },
  storeLogo: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  storeLogoImage: { width: '100%', height: '100%' },
  storeName: { marginTop: spacing.sm, ...typography.titleMd, color: colors.charcoalText },
  storeDescription: { marginTop: 4, textAlign: 'center', color: colors.outline, ...typography.bodySm },
  statsRow: { flexDirection: 'row-reverse', width: '100%', justifyContent: 'space-around', marginTop: spacing.md },
  stat: { alignItems: 'center' }, statValue: { fontWeight: '800', color: colors.charcoalText }, statLabel: { color: colors.outline, fontSize: 11, marginTop: 2 },
  actionsRow: { flexDirection: 'row-reverse', gap: spacing.sm, width: '100%', marginTop: spacing.md },
  actionButton: { flex: 1, minHeight: 42, borderRadius: radius.md, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 6 },
  primaryButton: { backgroundColor: colors.orangeVibrant }, primaryText: { color: colors.white, fontWeight: '800' },
  outlineButton: { borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surface }, outlineText: { color: colors.charcoalText, fontWeight: '800' },
  sectionTitle: { marginHorizontal: spacing.md, marginBottom: spacing.sm, textAlign: 'right', ...typography.titleSm, color: colors.charcoalText },
  listContent: { paddingBottom: 24 }, columnRow: { gap: spacing.sm, paddingHorizontal: spacing.md },
  productCard: { flex: 1, maxWidth: '50%', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.sm, ...cardShadow.level1 },
  productImageWrap: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  productImage: { width: '100%', height: '100%' }, productTitle: { marginTop: spacing.sm, textAlign: 'right', color: colors.charcoalText, fontWeight: '700' },
  productPrice: { marginTop: 4, textAlign: 'right', color: colors.orangeVibrant, fontWeight: '800' }, currency: { fontSize: 11 },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, marginTop: 4 }, rating: { fontSize: 10, color: colors.outline },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 40 }, emptyText: { marginTop: spacing.sm, color: colors.outline },
});
