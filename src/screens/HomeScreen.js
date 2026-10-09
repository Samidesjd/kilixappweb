import { TText, LTextInput } from '../context/LanguageContext';
import React, { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  RefreshControl,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, sizes, typography } from '../theme/theme';
import { useCart } from '../context/CartContext';
import { useData } from '../context/DataContext';
import ProductCard from '../components/ProductCard';
import { useFirestoreProducts } from '../hooks/useFirestoreProducts';
import { splitIntoBalancedColumns } from '../utils/productLayout';

// فلاتر التصنيفات الثابتة في الصفحة الرئيسية — يجب أن تطابق تماماً القيم المسموحة
// لحقل `category` في مستندات مجموعة 'products' على Firestore
const CATEGORY_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'electronics', label: 'إلكترونيات' },
  { id: 'clothing', label: 'نسيج وملابس' },
  { id: 'home', label: 'أدوات منزلية' },
  { id: 'construction', label: 'بناء وإنشاء' },
];

/**
 * Remove Arabic diacritics (harakat) for better search normalization.
 * Handles: fatha, damma, kasra, sukun, shadda, etc.
 */
function normalizeArabicText(text) {
  if (!text) return '';
  // Remove common Arabic diacritics
  const arabicdiacritics =
    /[\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0653\u0654\u0655\u0656\u0657\u0658]/g;
  return text.replace(arabicdiacritics, '');
}

/**
 * Levenshtein distance algorithm for fuzzy matching.
 * Returns the edit distance between two strings.
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }

  return matrix[len2][len1];
}

/**
 * Calculate similarity score between query and candidate text.
 * Returns a score between 0 and 1, where 1 is a perfect match.
 * Handles fuzzy matching with typo tolerance and partial word matching.
 */
function calculateSimilarityScore(query, candidate) {
  if (!query || !candidate) return 0;

  const normalizedQuery = normalizeArabicText(query.toLowerCase());
  const normalizedCandidate = normalizeArabicText(candidate.toLowerCase());

  // Exact match (highest score)
  if (normalizedCandidate.includes(normalizedQuery)) {
    return 0.9 + normalizedQuery.length / normalizedCandidate.length * 0.1;
  }

  // Check if all characters of query exist in candidate in order
  let queryIdx = 0;
  for (let i = 0; i < normalizedCandidate.length && queryIdx < normalizedQuery.length; i++) {
    if (normalizedCandidate[i] === normalizedQuery[queryIdx]) {
      queryIdx++;
    }
  }
  if (queryIdx === normalizedQuery.length) {
    return 0.7 + queryIdx / normalizedCandidate.length * 0.2;
  }

  // Fuzzy matching with Levenshtein distance
  const maxLen = Math.max(normalizedQuery.length, normalizedCandidate.length);
  const distance = levenshteinDistance(normalizedQuery, normalizedCandidate);
  const tolerance = Math.ceil(normalizedQuery.length * 0.3); // Allow 30% typo tolerance

  if (distance <= tolerance) {
    const score = Math.max(0, 1 - distance / maxLen);
    return score * 0.6;
  }

  return 0;
}

/**
 * Perform smart fuzzy search on products.
 * Searches in title, description, and returns results sorted by relevance.
 */
function smartFuzzySearch(query, products) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const results = [];

  for (const product of products) {
    const titleScore = calculateSimilarityScore(query, product.title || '');
    const descriptionScore = calculateSimilarityScore(query, product.description || '');

    const maxScore = Math.max(titleScore, descriptionScore);

    if (maxScore > 0.4) {
      // Only include if relevance score is above 40%
      results.push({
        ...product,
        relevanceScore: maxScore,
        matchedField: titleScore > descriptionScore ? 'title' : 'description',
      });
    }
  }

  // Sort by relevance score descending
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export default function HomeScreen({ navigation, route }) {
  const { itemCount } = useCart();
  const { unreadNotificationsCount, loadNotifications } = useData();

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications])
  );
  const [activeCategory, setActiveCategory] = useState(route?.params?.categoryId || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { products, loading: loadingProducts, loadingMore: loadingMoreProducts, hasMore: hasMoreProducts, loadMoreProducts, refreshProducts } = useFirestoreProducts();

  // عند تغيّر الـ params من خارج (مثلاً من CategoriesScreen) نُحدّث الفئة النشطة
  React.useEffect(() => {
    if (route?.params?.categoryId) {
      setActiveCategory(route.params.categoryId);
    }
  }, [route?.params?.categoryId]);

  const filteredProducts = useMemo(
    () => (activeCategory === 'all' ? products : products.filter((p) => p.category === activeCategory)),
    [products, activeCategory]
  );

  // نبني توزيع المنتجات بين العمودين هنا (وليس داخل الـ JSX) باش يُعاد حسابه فقط
  // عند تغيّر قائمة المنتجات نفسها، مش فكل إعادة رسم.
  const { columnA, columnB } = useMemo(() => splitIntoBalancedColumns(filteredProducts), [filteredProducts]);

  // Perform smart search when query changes
  const searchResults = useMemo(() => smartFuzzySearch(searchQuery, products), [searchQuery, products]);

  // Split search results into balanced columns for consistent UI with main grid
  const { columnA: searchColumnA, columnB: searchColumnB } = useMemo(
    () => splitIntoBalancedColumns(searchResults),
    [searchResults]
  );

  // Handle search input focus
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshProducts(); } catch (error) { if (__DEV__) console.error('[HomeScreen] refresh error:', error); } finally { setRefreshing(false); }
  }, [refreshProducts]);

  const handleSearchInputFocus = useCallback(() => {
    setIsSearchModalVisible(true);
  }, []);

  // Handle close modal
  const handleCloseModal = useCallback(() => {
    setIsSearchModalVisible(false);
    setSearchQuery('');
  }, []);

  // Handle search result selection
  const handleSearchResultPress = useCallback(
    (product) => {
      handleCloseModal();
      navigation.navigate('ProductDetail', { product });
    },
    [handleCloseModal, navigation]
  );

  // Render search modal
  const renderSearchModal = () => (
    <Modal visible={isSearchModalVisible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.modalContainer} edges={['top']}>
        {/* Search Header */}
        <View style={styles.modalHeader}>
          <Pressable onPress={handleCloseModal} hitSlop={8}>
            <MaterialIcons name="close" size={24} color={colors.charcoalText} />
          </Pressable>
          <View style={styles.modalSearchRow}>
            <MaterialIcons name="search" size={20} color={colors.outline} />
            <LTextInput
              autoFocus
              placeholder="ابحث عن منتجات..."
              placeholderTextColor={colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.modalSearchInput}
              textAlign="right"
            />
          </View>
        </View>

        {/* Search Results */}
        <View style={styles.modalContent}>
          {searchQuery.trim().length === 0 ? (
            // Empty state
            <View style={styles.emptyState}>
              <MaterialIcons name="search" size={48} color={colors.outline} />
              <TText style={styles.emptyStateTitle}>ابحث عن منتجات</TText>
              <TText style={styles.emptyStateSubtitle}>ابدأ بكتابة ما تبحث عنه للعثور على منتجات</TText>
            </View>
          ) : searchResults.length === 0 ? (
            // No results state
            <View style={styles.emptyState}>
              <MaterialIcons name="close-circle" size={48} color={colors.outline} />
              <TText style={styles.emptyStateTitle}>لم نجد نتائج</TText>
              <TText style={styles.emptyStateSubtitle}>جرّب كلمات بحث مختلفة</TText>
            </View>
          ) : (
            // Results grid using ProductCard (matching main screen design exactly)
            <ScrollView contentContainerStyle={styles.searchResultsContainer} showsVerticalScrollIndicator>
              <View style={styles.masonryRow}>
                <View style={styles.masonryColumn}>
                  {searchColumnA.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onPress={() => handleSearchResultPress(p)}
                      onInterest={handleProductInterest}
                    />
                  ))}
                </View>
                <View style={styles.masonryColumn}>
                  {searchColumnB.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onPress={() => handleSearchResultPress(p)}
                      onInterest={handleProductInterest}
                    />
                  ))}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TText style={styles.title}>Kilix</TText>

        <Pressable
          onPress={() => navigation.navigate('Notifications')}
          hitSlop={8}
          style={styles.notificationButton}
        >
          <MaterialIcons name="notifications-none" size={24} color={colors.onSurfaceVariant} />
          {unreadNotificationsCount > 0 ? (
            <View style={styles.notificationBadge}>
              <TText style={styles.notificationBadgeText}>
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </TText>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Cart')}
          hitSlop={8}
          style={[styles.cartIconWrap, styles.cartButton]}
        >
          <MaterialIcons name="shopping-cart" size={24} color={colors.onSurfaceVariant} />
          {itemCount > 0 ? (
            <View style={styles.cartBadge}>
              <TText style={styles.cartBadgeText}>{itemCount > 99 ? '99+' : itemCount}</TText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }} onScroll={({ nativeEvent }) => { const { layoutMeasurement, contentOffset, contentSize } = nativeEvent; if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 500) void loadMoreProducts(); }} scrollEventThrottle={250} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <Pressable onPress={handleSearchInputFocus} style={styles.searchRow}>
          <MaterialIcons name="search" size={20} color={colors.outline} />
          <LTextInput
            placeholder="ابحث عن منتجات، موردين..."
            placeholderTextColor={colors.outline}
            style={styles.searchInput}
            textAlign="right"
            editable={false}
          />
          <Pressable onPress={() => navigation.navigate('ImageSearch')} hitSlop={10}>
            <MaterialIcons name="photo-camera" size={20} color={colors.charcoalText} />
          </Pressable>
        </Pressable>

        <ScrollView horizontal inverted showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
          {CATEGORY_FILTERS.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setActiveCategory(c.id)}
              style={[styles.chip, activeCategory === c.id && styles.chipActive]}
            >
              <TText style={[styles.chipText, activeCategory === c.id && { color: colors.white }]}>{c.label}</TText>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.banner}>
          <MaterialIcons name="verified-user" size={20} color={colors.charcoalText} />
          <TText style={styles.bannerText}>
            معاملات والمحادثات محمية داخل التطبيق
          </TText>
        </View>

        {loadingProducts ? (
          <TText style={styles.empty}>جارٍ تحميل المنتجات...</TText>
        ) : filteredProducts.length === 0 ? (
          <TText style={styles.empty}>لا توجد منتجات في هذا التصنيف حالياً</TText>
        ) : (
          <View style={styles.masonryRow}>
            <View style={styles.masonryColumn}>
              {columnA.map((p) => (
                <ProductCard key={p.id} product={p} onPress={() => navigation.navigate('ProductDetail', { product: p })} onInterest={handleProductInterest} />
              ))}
            </View>
            <View style={styles.masonryColumn}>
              {columnB.map((p) => (
                <ProductCard key={p.id} product={p} onPress={() => navigation.navigate('ProductDetail', { product: p })} onInterest={handleProductInterest} />
              ))}
            </View>
          </View>
        )}
        {hasMoreProducts ? <TText style={styles.empty}>{loadingMoreProducts ? 'جارٍ تحميل المزيد...' : 'اسحب للأسفل لرؤية المزيد'}</TText> : null}
      </ScrollView>

      {renderSearchModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    height: sizes.headerHeight,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  title: { ...typography.headlineMobile, color: colors.charcoalText },
  searchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, ...typography.bodyLg, color: colors.onSurface },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.white,
    marginHorizontal: spacing.xs,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.charcoalText,
    borderColor: colors.charcoalText,
  },
  chipText: {
    ...typography.bodySm,
    fontSize: 13,
    color: colors.charcoalText,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    backgroundColor: 'rgba(27,54,93,0.08)',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  bannerText: { ...typography.bodySm, color: colors.charcoalText, flex: 1, textAlign: 'right' },
  masonryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  masonryColumn: { flex: 1, gap: spacing.xs },
  empty: { ...typography.bodySm, color: colors.outline, width: '100%', textAlign: 'center', marginTop: spacing.xl },
  // Header actions: cart is immediately to the left of notifications.
  notificationButton: {
    position: 'absolute',
    left: spacing.md + 40,
    top: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButton: {
    position: 'absolute',
    left: spacing.md,
    top: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  notificationBadgeText: {
    color: colors.white,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },

  cartIconWrap: { position: 'relative' },
  cartBadge: {
    position: 'absolute',
    top: -6,
    left: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.orangeVibrant,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },

  // Search Modal Styles
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  modalSearchRow: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  modalSearchInput: { flex: 1, ...typography.bodyLg, color: colors.onSurface },
  modalContent: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyStateTitle: {
    ...typography.titleMd,
    color: colors.charcoalText,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    ...typography.bodySm,
    color: colors.outline,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  searchResultsContainer: {
    paddingBottom: spacing.lg,
  },
});
