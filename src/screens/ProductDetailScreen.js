import { TText, LTextInput, useLanguage } from '../context/LanguageContext';
import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
  Image,
  useWindowDimensions,
  StatusBar,
  Share,
  KeyboardAvoidingView,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import PrimaryButton from '../components/PrimaryButton';
import VariantGroupsManager from '../components/VariantGroupsManager';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { getProductVariantGroups, isVariantCombinationAvailable } from '../constants/variants';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { useAuth } from '../context/AuthContext';
import { createOrder } from '../services/orderService';
import { getProductReviews, getProductRating } from '../services/reviewService';
import { getProducts, getProduct, getStoreRatingSummary, getProductUnitsSold } from '../services/productService';
import { subscribeToProductReviews, subscribeToStoreProducts, subscribeToProductOrders } from '../services/Realtimeservice';
import GuestAuthModal from '../components/GuestAuthModal';

const BRAND_ORANGE = '#FF6B00';

import { ALGERIA_WILAYAS, getLocalizedLocationName } from '../constants/algeriaLocations';

const GUARANTEES = [
  { icon: 'local-shipping', label: 'توصيل آمن', color: BRAND_ORANGE },
  { icon: 'verified-user', label: 'دفع عند الاستلام', color: colors.secondary },
];

const SIM_IMAGE_HEIGHTS = [150, 130, 170, 120, 145, 160];
function simImageHeight(id) {
  const str = String(id);
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return SIM_IMAGE_HEIGHTS[h % SIM_IMAGE_HEIGHTS.length];
}

function Stars({ size = 14, rating = 5 }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <MaterialIcons
          key={i}
          name={i < full ? 'star' : i === full && hasHalf ? 'star-half' : 'star-border'}
          size={size}
          color={BRAND_ORANGE}
        />
      ))}
    </View>
  );
}

function ViewerImage({ uri, width, height }) {
  return (
    <View style={{ width, height, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={{ uri }}
        style={{ width, height }}
        resizeMode="contain"
      />
    </View>
  );
}

function PremiumGallery({ images, isFav, onToggleFav, navigation, onShare }) {
  // ✅ استدعاء الخطاف هنا - داخل component مباشرة
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const [activeIdx, setActiveIdx] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);
  const mainRef = useRef(null);
  const viewerRef = useRef(null);
  const thumbRef = useRef(null);

  const safeImages = useMemo(() => {
    const filtered = images?.filter((img) => typeof img === 'string' && img.trim().length > 0);
    return filtered?.length ? filtered : [null];
  }, [images]);

  const GALLERY_H = width * 1.05;
  const { height: screenHeight } = useWindowDimensions();

  const onMainScroll = useCallback(
    (e) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / width);
      if (idx !== activeIdx) {
        setActiveIdx(idx);
        thumbRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      }
    },
    [width, activeIdx]
  );

  const goToImage = (idx) => {
    setActiveIdx(idx);
    mainRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  const openImageViewer = (idx) => {
    const safeIndex = Math.max(0, Math.min(idx, safeImages.length - 1));
    setViewerIdx(safeIndex);
    setViewerVisible(true);
  };

  const closeImageViewer = () => { setViewerVisible(false); };

  const onViewerScroll = useCallback(
    (e) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / width);
      if (idx !== viewerIdx && idx >= 0 && idx < safeImages.length) {
        setViewerIdx(idx);
      }
    },
    [width, viewerIdx, safeImages.length]
  );

  return (
    <View style={{ backgroundColor: colors.white }}>
      <View style={{ height: GALLERY_H, backgroundColor: colors.white }}>
        <FlatList
          ref={mainRef}
          data={safeImages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `main-${i}`}
          onScroll={onMainScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item }) =>
            item ? (
              <Pressable onPress={() => openImageViewer(activeIdx)} style={{ width, height: GALLERY_H, backgroundColor: colors.mistGray }}>
                <Image source={{ uri: item }} style={{ width, height: GALLERY_H }} resizeMode="cover" />
              </Pressable>
            ) : (
              <View style={[galleryStyles.placeholderContainer, { width, height: GALLERY_H }]}>
                <MaterialIcons name="laptop" size={64} color={colors.outlineVariant} />
              </View>
            )
          }
        />

        <View style={[galleryStyles.topOverlay, { paddingTop: insets.top + spacing.xs }]}>
          <Pressable onPress={() => navigation.goBack()} style={galleryStyles.overlayIconBtn} hitSlop={8}>
            <MaterialIcons name="arrow-forward" size={22} color={colors.charcoalText} />
          </Pressable>

          <View style={galleryStyles.rightOverlayActions}>
            <Pressable style={galleryStyles.overlayIconBtn} hitSlop={8}>
              <MaterialIcons name="search" size={20} color={colors.charcoalText} />
            </Pressable>
            <Pressable style={galleryStyles.overlayIconBtn} onPress={onShare} hitSlop={8}>
              <MaterialIcons name="share" size={20} color={colors.charcoalText} />
            </Pressable>
          </View>
        </View>

        <View style={galleryStyles.counterPill}>
          <TText style={galleryStyles.counterText}>{`الصورة ${activeIdx + 1} من ${safeImages.length}`}</TText>
        </View>

        <Pressable onPress={onToggleFav} style={galleryStyles.favCircleBtn} hitSlop={8}>
          <MaterialIcons
            name={isFav ? 'favorite' : 'favorite-border'}
            size={20}
            color={isFav ? BRAND_ORANGE : colors.charcoalText}
          />
        </Pressable>
      </View>

      <View style={galleryStyles.thumbHeaderRow}>
        <TText style={galleryStyles.thumbLabelText}>{`الصورة ${activeIdx + 1} من ${safeImages.length}`}</TText>
        <MaterialIcons name="chevron-left" size={18} color={colors.outline} />
      </View>

      <View style={galleryStyles.thumbStrip}>
        <FlatList
          ref={thumbRef}
          data={safeImages}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `thumb-${i}`}
          getItemLayout={(_, index) => ({ length: 62, offset: 62 * index, index })}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => goToImage(index)}
              style={[
                galleryStyles.thumb,
                index === activeIdx && galleryStyles.thumbActive,
              ]}
            >
              {item ? (
                <View style={{ backgroundColor: colors.mistGray, borderRadius: radius.xs }}>
                  <Image source={{ uri: item }} style={galleryStyles.thumbImg} resizeMode="cover" />
                </View>
              ) : (
                <View style={galleryStyles.thumbPlaceholder}>
                  <MaterialIcons name="image" size={18} color={colors.outlineVariant} />
                </View>
              )}
            </Pressable>
          )}
        />
      </View>

      <Modal
        visible={viewerVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={closeImageViewer}
        statusBarTranslucent
      >
        <View style={galleryStyles.viewerRoot}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />

          <FlatList
            ref={viewerRef}
            data={safeImages}
            horizontal
            pagingEnabled
            initialScrollIndex={viewerIdx}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => `viewer-${i}`}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onScroll={onViewerScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <View style={{ width, flex: 1, backgroundColor: '#000' }}>
                {item ? (
                  <ViewerImage uri={item} width={width} height={screenHeight} />
                ) : (
                  <View style={galleryStyles.viewerPlaceholder}>
                    <MaterialIcons name="image" size={72} color="#666666" />
                  </View>
                )}
              </View>
            )}
          />

          <View style={[galleryStyles.viewerTopBar, { paddingTop: insets.top + spacing.xs }]}>
            <Pressable onPress={closeImageViewer} style={galleryStyles.viewerCloseBtn} hitSlop={10}>
              <MaterialIcons name="arrow-back" size={26} color="#fff" />
            </Pressable>
            <View style={galleryStyles.viewerCounter}>
              <TText style={galleryStyles.viewerCounterText}>
                {viewerIdx + 1} / {safeImages.length}
              </TText>
            </View>
          </View>

        </View>
      </Modal>
    </View>
  );
}

const galleryStyles = StyleSheet.create({
  placeholderContainer: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mistGray },
  viewerRoot: { flex: 1, backgroundColor: '#000' },
  viewerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  viewerTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, zIndex: 20,
  },
  viewerCloseBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerCounter: {
    minWidth: 62, height: 34, borderRadius: 17,
    paddingHorizontal: 12, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerCounterText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, zIndex: 10,
  },
  rightOverlayActions: { flexDirection: 'row-reverse', gap: spacing.sm },
  overlayIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center', justifyContent: 'center',
    ...cardShadow.level1,
  },
  counterPill: {
    position: 'absolute', bottom: 14, left: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.55)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  counterText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  favCircleBtn: {
    position: 'absolute', bottom: 12, right: spacing.md,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    ...cardShadow.level1,
  },
  thumbHeaderRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  thumbLabelText: { ...typography.bodySm, fontWeight: '600', color: colors.charcoalText },
  thumbStrip: { paddingVertical: spacing.sm },
  thumb: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1.5, borderColor: 'transparent' },
  thumbActive: { borderColor: colors.charcoalText },
  thumbImg: { width: 54, height: 54, borderRadius: radius.xs },
  thumbPlaceholder: {
    width: 54, height: 54, borderRadius: radius.xs,
    backgroundColor: colors.mistGray, alignItems: 'center', justifyContent: 'center',
  },
});

function Divider() {
  return <View style={{ height: 8, backgroundColor: colors.surfaceContainerHighest }} />;
}

function Section({ children, style }) {
  return <View style={[{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.white }, style]}>{children}</View>;
}

function makeEmptyGroup(minQty = 1) {
  return { id: `grp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, qty: Math.max(1, Number(minQty) || 1), variants: {} };
}

export default function ProductDetailScreen({ route, navigation }) {
  const { language } = useLanguage();
  const routeProduct = route.params?.product;
  const [loadedProduct, setLoadedProduct] = useState(null);
  const [productUnavailable, setProductUnavailable] = useState(false);
  const product = loadedProduct || routeProduct;
  useEffect(() => {
    let active = true;
    const productId = route.params?.productId || route.params?.id || routeProduct?.id;
    if (!productId) return undefined;

    // Load the authoritative product row. This also supports direct web
    // links such as /product/<id>, where no product object was passed in navigation.
    void getProduct(productId)
      .then((row) => {
        if (!active || !row || row.is_active === false) {
          if (active) { setLoadedProduct(null); setProductUnavailable(true); }
          return;
        }
        setProductUnavailable(false);
        setLoadedProduct({
          ...(routeProduct || {}),
          ...row,
          storeId: row.store_id || routeProduct?.storeId,
          store_id: row.store_id || routeProduct?.store_id,
        });
      })
      .catch(() => { if (active) { setLoadedProduct(null); setProductUnavailable(true); } });

    return () => { active = false; };
  }, [route.params?.productId, route.params?.id, routeProduct?.id]);

  const galleryImages = product?.images?.length
    ? product.images
    : product?.image
    ? [product.image]
    : [];
  const productStoreId = product?.storeId || product?.store_id || null;
  const variantGroups = useMemo(() => getProductVariantGroups(product) || [], [product]);
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user } = useAuth();

  const [groups, setGroups] = useState([makeEmptyGroup(1)]);
  useEffect(() => {
    if (product?.id) setGroups([makeEmptyGroup(Math.max(1, Number(product.min_order_quantity) || 1))]);
  }, [product?.id, product?.min_order_quantity]);
  const [notes, setNotes] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [guestAuthVisible, setGuestAuthVisible] = useState(false);

  const [step, setStep] = useState('CUSTOMIZE');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState('home');
  const [selectedWilaya, setSelectedWilaya] = useState(null);
  const [selectedCommune, setSelectedCommune] = useState(null);
  const [streetAddress, setStreetAddress] = useState('');
  const [wilayaDropdownOpen, setWilayaDropdownOpen] = useState(false);
  const [communeDropdownOpen, setCommuneDropdownOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [formError, setFormError] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fav = product ? isFavorite(product.id) : false;
  const priceVal = Number(product?.price) || 0;
  const currency = 'دج';
  const originalPrice = null;
  const discountPct = null;

  const [similarProducts, setSimilarProducts] = React.useState([]);
  const [productReviews, setProductReviews] = React.useState([]);
  const [productAverageRating, setProductAverageRating] = React.useState(0);
  const [productReviewCount, setProductReviewCount] = React.useState(0);
  const [storeAverageRating, setStoreAverageRating] = React.useState(0);
  const [storeReviewCount, setStoreReviewCount] = React.useState(0);
  const [productUnitsSold, setProductUnitsSold] = React.useState(0);
  const orderMinQuantity = Math.max(1, Number(product?.min_order_quantity) || 1);
  const orderMaxQuantity = Math.max(orderMinQuantity, Number(product?.max_order_quantity) || 1000000);


  React.useEffect(() => {
    if (!product?.category) return;

    let mounted = true;

    const mapRow = (data) => ({
      id: data.id,
      title: data.title || '',
      price: typeof data.price === 'number'
        ? data.price.toLocaleString('en-US')
        : String(data.price || ''),
      rating: data.average_rating || data.rating || null,
      currency: 'دج',
      image: data.image || (data.images?.[0] || null),
      images: data.images || [],
      category: data.category || '',
      storeId: data.store_id || data.storeId || null,
      imageHeight: simImageHeight(data.id),
    });

    const fetchSimilar = async () => {
      let data;
      try {
        data = await getProducts({ category: product.category });
      } catch (error) {
        if (__DEV__) console.error('[ProductDetailScreen] similar products error:', error);
        return;
      }
      if (!mounted) return;
      const mapped = (data || [])
        .filter((d) => d.id !== product.id)
        .slice(0, 6)
        .map(mapRow);
      setSimilarProducts(mapped);
    };

    fetchSimilar();

    const unsubscribe = subscribeToStoreProducts(productStoreId || '', () => fetchSimilar());
    return () => { mounted = false; unsubscribe(); };
  }, [product?.id, product?.category, productStoreId]);

  React.useEffect(() => {
    if (!product?.id) return;

    let mounted = true;

    const applyReviews = (rows) => {
      const rawReviews = Array.isArray(rows) ? rows : [];
      const reviews = [...rawReviews].map((r, idx) => ({
        id: r.id || `rev_${idx}`,
        initials: r.user_id ? r.user_id.slice(0, 2).toUpperCase() : 'ز.م',
        name: r.reviewer_name || r.reviewer_code || 'مستخدم',
        date: r.created_at ? new Date(r.created_at).toLocaleDateString('ar') : '',
        rating: Number(r.rating) || 0,
        text: r.comment || '',
      }));
      setProductReviews(reviews);
    };

    const fetchProductReviews = async () => {
      try {
        const [data, rating] = await Promise.all([
          getProductReviews(product.id, 4),
          getProductRating(product.id),
        ]);
        if (mounted) {
          applyReviews(data);
          setProductAverageRating(rating.average);
          setProductReviewCount(rating.count);
        }
      } catch (error) {
        if (__DEV__) console.error('[ProductDetailScreen] product reviews fetch error:', error);
        if (mounted) applyReviews([]);
      }
    };

    fetchProductReviews();

    const unsubscribe = subscribeToProductReviews(product.id, () => fetchProductReviews());
    return () => { mounted = false; unsubscribe(); };
  }, [product?.id]);

  React.useEffect(() => {
    if (!productStoreId) { setStoreAverageRating(0); setStoreReviewCount(0); return; }
    let mounted = true;
    const fetchStoreRatings = async () => {
      try {
        const summary = await getStoreRatingSummary(productStoreId);
        if (mounted) { setStoreAverageRating(summary.average); setStoreReviewCount(summary.count); }
      } catch (error) {
        if (__DEV__) console.error('[ProductDetailScreen] store ratings error:', error);
      }
    };
    fetchStoreRatings();
    const unsubscribe = subscribeToStoreProducts(productStoreId, fetchStoreRatings);
    return () => { mounted = false; unsubscribe(); };
  }, [productStoreId]);


  React.useEffect(() => {
    if (!product?.id) { setProductUnitsSold(0); return; }
    let mounted = true;
    const fetchUnitsSold = async () => {
      try {
        const totalUnits = await getProductUnitsSold(product.id);
        if (mounted) setProductUnitsSold(totalUnits);
      } catch (error) {
        if (__DEV__) console.error('[ProductDetailScreen] units sold error:', error);
      }
    };
    fetchUnitsSold();
    const unsubscribe = subscribeToProductOrders(product.id, fetchUnitsSold);
    return () => { mounted = false; unsubscribe(); };
  }, [product?.id]);

  const leftColumnItems = useMemo(() => similarProducts.filter((_, i) => i % 2 === 0), [similarProducts]);
  const rightColumnItems = useMemo(() => similarProducts.filter((_, i) => i % 2 !== 0), [similarProducts]);

  const validGroups = groups.filter((g) => {
    if (!variantGroups || variantGroups.length === 0) return true;
    const allSelected = variantGroups.every((vg) => !!g.variants[vg.key]);
    const isAvailable = isVariantCombinationAvailable ? isVariantCombinationAvailable(product, g.variants) : true;
    return allSelected && isAvailable;
  });

  const allGroupsValid = validGroups.length === groups.length && groups.length > 0;
  const totalQty = groups.reduce((s, g) => s + g.qty, 0);

  const handleShareProduct = async () => {
    if (!product?.id) return;

    try {
      // On web, keep the current host so the link follows the actual deployment.
      // On native, use the public Kilix web address.
      const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin + '/kilixappweb'
        : 'https://samidesjd.github.io/kilixappweb';
      // GitHub Pages-safe share URL: the query keeps the server on the root page on refresh.
      const productUrl = `${baseUrl}/?product=${encodeURIComponent(String(product.id))}`;

      await Share.share({
        title: product.title || 'تفاصيل المنتج',
        message: `شاهد هذا المنتج على Kilix: ${product.title || 'المنتج'}\nالسعر: ${priceVal} ${currency}\n${productUrl}`,
        url: productUrl,
      });
    } catch (error) {
      if (__DEV__) console.log('Error sharing product:', error);
    }
  };

  const openOrderModal = () => {
    if (productUnavailable) {
      setFormError('هذا المنتج لم يعد متاحاً من طرف التاجر.');
      return;
    }
    if (user && user.isGuest) {
      setGuestAuthVisible(true);
      return;
    }
    setStep('CUSTOMIZE');
    setGroups([makeEmptyGroup(orderMinQuantity)]);
    setShowErrors(false);
    setFormError('');
    setModalVisible(true);
  };

  const handleGuestSignIn = () => {
    setGuestAuthVisible(false);
    navigation.navigate('Welcome');
  };

  const handleGuestCreateAccount = () => {
    setGuestAuthVisible(false);
    navigation.navigate('Welcome');
  };

  const quantityWithinOrderRange = totalQty >= orderMinQuantity && totalQty <= orderMaxQuantity;
  const addGroup = () => setGroups((p) => [...p, makeEmptyGroup(orderMinQuantity)]);
  const removeGroup = (id) => setGroups((p) => (p.length > 1 ? p.filter((g) => g.id !== id) : p));
  const changeGroupQty = (id, qty) =>
    setGroups((p) => p.map((g) => (g.id === id ? { ...g, qty: Math.min(orderMaxQuantity, Math.max(orderMinQuantity, Number(qty) || orderMinQuantity)) } : g)));
  const selectGroupVariant = (id, gk, ok) =>
    setGroups((p) => p.map((g) => (g.id === id ? { ...g, variants: { ...g.variants, [gk]: ok } } : g)));

  const handleAddToCart = () => {
    if (!allGroupsValid || !quantityWithinOrderRange) {
      setShowErrors(true);
      return;
    }
    if (product) groups.forEach((g) => addItem(product, g.qty, g.variants));
    setStep('SUCCESS');
  };

  const handleProceedToCheckoutForm = () => {
    if (!allGroupsValid || !quantityWithinOrderRange) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep('CHECKOUT_FORM');
  };

  const handleContinueToOtp = async () => {
    if (!quantityWithinOrderRange) {
      setFormError(`الكمية الإجمالية يجب أن تكون بين ${orderMinQuantity} و${orderMaxQuantity} وحدة`);
      return;
    }
    if (!fullName.trim() || !phone.trim() || !selectedWilaya) {
      setFormError('يرجى ملء الاسم، اللقب، رقم الهاتف، والولاية.');
      return;
    }
    if (deliveryType === 'home' && (!selectedCommune || !streetAddress.trim())) {
      setFormError('يرجى اختيار البلدية وإدخال الشارع لتوصيل المنزل.');
      return;
    }
    if (deliveryType === 'office' && !selectedCommune) {
      setFormError('يرجى اختيار البلدية (مكتب التوصيل).');
      return;
    }
    if (!product?.id || !productStoreId) {
      setFormError('تعذّر تحديد بيانات المنتج أو المتجر، يرجى المحاولة لاحقاً.');
      return;
    }

    setFormError('');
    setSubmittingOrder(true);

    try {
      const orderDetails = groups.map((g) => ({
        product_id: product.id,
        title: product?.title || '',
        options: g.variants || {},
        quantity: g.qty,
      }));

      await createOrder({
        productId: product.id,
        storeId: productStoreId,
        customerName: fullName.trim(),
        phone: phone.trim(),
        deliveryType,
        wilaya: selectedWilaya?.name || String(selectedWilaya || ''),
        commune: selectedCommune || '',
        streetAddress: deliveryType === 'home' ? streetAddress.trim() : null,
        notes: notes.trim(),
        quantity: totalQty,
        details: orderDetails,
      });

      if (product) groups.forEach((g) => addItem(product, g.qty, g.variants));
      setStep('SUCCESS');
    } catch (error) {
      if (__DEV__) console.error('Error creating order:', error);
      setFormError('تعذّر إرسال الطلب، يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const goToCart = () => {
    setModalVisible(false);
    setStep('CUSTOMIZE');
    setGroups([makeEmptyGroup(orderMinQuantity)]);
    navigation.navigate('Cart');
  };

  const handleRefresh = useCallback(async () => {
    if (!product?.id) return;
    setRefreshing(true);
    try {
      const [row, reviews, rating] = await Promise.all([getProduct(product.id), getProductReviews(product.id, 4), getProductRating(product.id)]);
      setLoadedProduct((prev) => ({ ...(prev || routeProduct), ...row, storeId: row.store_id || prev?.storeId || routeProduct?.storeId, store_id: row.store_id || prev?.store_id || routeProduct?.store_id }));
      setProductReviews((reviews || []).map((r, idx) => ({ id: r.id || `rev_${idx}`, initials: r.user_id ? r.user_id.slice(0,2).toUpperCase() : 'ز.م', name: r.reviewer_name || r.reviewer_code || 'مستخدم', date: r.created_at ? new Date(r.created_at).toLocaleDateString('ar') : '', rating: Number(r.rating)||0, text: r.comment||'' })));
      setProductAverageRating(rating.average); setProductReviewCount(rating.count);
    } finally { setRefreshing(false); }
  }, [product?.id, routeProduct]);

  const continueShopping = () => {
    setModalVisible(false);
    setStep('CUSTOMIZE');
    setGroups([makeEmptyGroup(orderMinQuantity)]);
  };

  const renderSimilarCard = (item) => (
    <Pressable
      key={item.id}
      style={({ pressed }) => [s.similarCard, pressed && { opacity: 0.88 }]}
      onPress={() => navigation.push('ProductDetail', { product: item })}
    >
      <View style={[s.similarImageHolder, { height: item.imageHeight }]}>
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={s.similarImage}
            resizeMode="cover"
          />
        ) : (
          <MaterialIcons name="image" size={32} color={colors.outlineVariant} />
        )}
        {item.discount ? (
          <View style={s.cardDiscountBadge}>
            <TText style={s.cardDiscountText}>خصم {item.discount}</TText>
          </View>
        ) : null}
        <Pressable style={s.cardFavBtn} hitSlop={6}>
          <MaterialIcons name="favorite-border" size={16} color={colors.charcoalText} />
        </Pressable>
      </View>

      <View style={s.similarCardContent}>
        <TText style={s.similarTitle} numberOfLines={2}>{item.title}</TText>

        <View style={s.cardRatingRow}>
          <MaterialIcons name="star" size={12} color="#FFB800" />
          <TText style={s.cardRatingText}>{item.rating}</TText>
        </View>

        <View style={s.cardPriceRow}>
          <TText style={s.similarPrice}>{item.price} {item.currency}</TText>
          {item.oldPrice ? (
            <TText style={s.similarOldPrice}>{item.oldPrice} {item.currency}</TText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={s.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <PremiumGallery
          images={galleryImages}
          isFav={fav}
          onToggleFav={() => product && toggleFavorite(product.id)}
          navigation={navigation}
          onShare={handleShareProduct}
        />

        <Divider />

        <Section style={{ gap: spacing.xs }}>
          <View style={s.supplierHeaderRow}>
            <Pressable
              style={s.storeIconBtn}
              onPress={() => navigation.navigate('StoreDetail', {
                storeName: product?.storeName || 'المتجر',
                storeId: productStoreId,
                storeRating: storeReviewCount > 0 ? storeAverageRating : 0,
              })}
              hitSlop={8}
            >
              {product?.stores?.logo_url ? (
                <Image source={{ uri: product.stores.logo_url }} style={s.storeIconImage} />
              ) : (
                <MaterialIcons name="storefront" size={18} color={BRAND_ORANGE} />
              )}
            </Pressable>
            <TText style={s.supplierTitle}>{product?.storeName || 'المتجر'}</TText>
            <View style={s.supplierRatingBadge}>
              <Stars size={12} rating={storeReviewCount > 0 ? storeAverageRating : 0} />
              <TText style={s.supplierRatingText}>
                {storeReviewCount > 0 ? `${storeAverageRating.toFixed(1)} م` : 'لا تقييم بعد'}
              </TText>
            </View>
          </View>

          <TText style={s.productTitle}>
            {product?.title || 'المنتج'}
          </TText>
          {String(product?.description || '').trim() ? (
            <TText style={s.productDescription} numberOfLines={3}>
              {String(product.description).trim()}
            </TText>
          ) : null}

          <View style={s.salesRatingRow}>
            <MaterialIcons name="star" size={14} color={BRAND_ORANGE} />
            <TText style={s.ratingNum}>
              {productReviewCount > 0 ? productAverageRating.toFixed(1) : '0.0'}
            </TText>
            <TText style={s.salesText}>
              {`تم بيع ${productUnitsSold.toLocaleString('en-US')} وحدة`}
            </TText>
          </View>
        </Section>

        <Section style={{ paddingTop: 0 }}>
          <View style={s.priceCard}>
            <View style={s.priceTopHeader}>
              {discountPct !== null ? (
                <View style={s.discountBadge}>
                  <TText style={s.discountBadgeText}>%{discountPct} خصم</TText>
                </View>
              ) : null}
              {originalPrice !== null ? (
                <TText style={s.strikethroughPrice}>
                  {originalPrice.toLocaleString('en-US')} {currency}
                </TText>
              ) : null}
              <TText style={s.soldBadgeText}>
                {`تم بيع ${productUnitsSold.toLocaleString('en-US')} وحدة`}
              </TText>
            </View>

            <View style={s.mainPriceRow}>
              <TText style={s.mainPriceCurrency}>{currency}</TText>
              <TText style={s.mainPriceVal}>{priceVal.toLocaleString('en-US')}</TText>
            </View>
          </View>
        </Section>

        <Divider />

        <Section style={{ gap: spacing.sm }}>
          <View style={s.guaranteesGrid}>
            {GUARANTEES.map((item, idx) => (
              <View key={idx} style={s.guaranteePill}>
                <MaterialIcons name={item.icon} size={15} color={item.color} />
                <TText style={s.guaranteePillText}>{item.label}</TText>
              </View>
            ))}
          </View>
        </Section>

        <Divider />

        <Section style={{ gap: spacing.sm }}>
          <TText style={s.sectionTitle}>خيارات المنتج</TText>

          <Pressable
            style={({ pressed }) => [s.optionPromptCard, productUnavailable && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}
            onPress={openOrderModal}
            disabled={productUnavailable}
          >
            <View style={s.optionPromptContent}>
              <View style={s.slidersIconCircle}>
                <MaterialIcons name="tune" size={18} color={BRAND_ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <TText style={s.optionPromptTitle}>{productUnavailable ? 'المنتج غير متاح حالياً' : 'اختر الكمية والخيارات'}</TText>
                <TText style={s.optionPromptSub}>
                  {productUnavailable ? 'تم حذف المنتج من مخزون التاجر ولا يمكن استقبال طلبات جديدة.' : `الحد الأدنى ${orderMinQuantity} والحد الأقصى ${orderMaxQuantity} وحدة للطلب`}
                </TText>
              </View>
            </View>
            <MaterialIcons name="chevron-left" size={20} color={colors.outline} />
          </Pressable>
        </Section>

        <Divider />

        <Section style={{ gap: spacing.sm }}>
          <View style={s.shippingCard}>
            <View style={s.shippingDetailRow}>
              <TText style={s.shippingValHighlight}>من يوم إلى 4 أيام</TText>
              <TText style={s.shippingLabel}>مدة الشحن :</TText>
            </View>
          </View>
        </Section>

        <Divider />

        <Section style={{ gap: spacing.sm }}>
          <TText style={s.sectionTitle}>تقييمات العملاء</TText>

          {productReviews.length === 0 ? (
            <TText style={{ fontSize: 12, color: colors.outline, textAlign: 'right' }}>
              لا توجد تقييمات بعد لهذا المنتج
            </TText>
          ) : null}
          {productReviews.map((rev, idx) => (
            <View key={rev.id || idx} style={s.reviewCard}>
              <View style={s.reviewCardHeader}>
                <View style={s.reviewAuthorRow}>
                  <View style={s.avatarCircle}>
                    <TText style={s.avatarText}>{rev.initials}</TText>
                  </View>
                  <View style={{ gap: 2 }}>
                    <TText style={s.reviewAuthorName}>{rev.name}</TText>
                    <View style={s.verifiedBadge}>
                      <TText style={s.verifiedBadgeText}>شراء مؤكد ✓</TText>
                    </View>
                  </View>
                </View>
                <TText style={s.reviewDate}>{rev.date}</TText>
              </View>

              <View style={{ marginVertical: 2 }}>
                <Stars size={12} rating={rev.rating} />
              </View>

              <TText style={s.reviewBodyText}>{rev.text}</TText>
            </View>
          ))}
        </Section>

        <Divider />

        <Section style={{ gap: spacing.sm }}>
          <TText style={s.sectionTitle}>منتجات قد تعجبك أيضاً</TText>
          <View style={s.masonryContainer}>
            <View style={s.masonryColumn}>
              {leftColumnItems.map(renderSimilarCard)}
            </View>
            <View style={s.masonryColumn}>
              {rightColumnItems.map(renderSimilarCard)}
            </View>
          </View>
        </Section>

      </ScrollView>

      <SafeAreaView edges={['bottom']} style={s.footerSafeArea}>
        <View style={s.footerContainer}>
          <Pressable style={s.cartIconBtn} onPress={() => navigation.navigate('Cart')} hitSlop={8}>
            <MaterialIcons name="shopping-cart" size={24} color={BRAND_ORANGE} />
            <TText style={s.cartIconLabel}>السلة</TText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              s.globalOrderBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={openOrderModal}
            disabled={productUnavailable}
          >
            <MaterialIcons name="shopping-bag" size={18} color={colors.white} />
            <TText style={s.globalOrderBtnText}>{productUnavailable ? 'غير متاح' : 'إجراء طلب'}</TText>
          </Pressable>
        </View>
      </SafeAreaView>

      <GuestAuthModal
        visible={guestAuthVisible}
        onClose={() => setGuestAuthVisible(false)}
        onSignIn={handleGuestSignIn}
        onCreateAccount={handleGuestCreateAccount}
        reason="cart"
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={s.modalSheet}>
            {step === 'CUSTOMIZE' && (
              <>
                <View style={s.modalHeader}>
                  <TText style={s.modalTitle}>تخصيص الطلب</TText>
                  <Pressable onPress={() => setModalVisible(false)} hitSlop={10}>
                    <MaterialIcons name="close" size={22} color={colors.charcoalText} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {variantGroups.length > 0 ? (
                    <VariantGroupsManager
                      product={product}
                      variantGroups={variantGroups}
                      groups={groups}
                      onAddGroup={addGroup}
                      onRemoveGroup={removeGroup}
                      onChangeQty={changeGroupQty}
                      onSelectVariant={selectGroupVariant}
                      showErrors={showErrors}
                      currency={currency}
                    />
                  ) : null}

                  <TText style={s.modalLabel}>ملاحظات إضافية</TText>
                  <LTextInput
                    style={s.notesInput}
                    placeholder="أدخل أي تفاصيل إضافية هنا..."
                    placeholderTextColor={colors.outline}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    textAlign="right"
                  />

                  {showErrors && !allGroupsValid ? (
                    <TText style={s.validationError}>
                      يرجى إكمال كل الخيارات الإلزامية في كل مجموعة والتأكد من توفرها
                    </TText>
                  ) : null}

                  {showErrors && (totalQty < orderMinQuantity || totalQty > orderMaxQuantity) ? (
                    <TText style={s.validationError}>
                      الكمية الإجمالية يجب أن تكون بين {orderMinQuantity} و{orderMaxQuantity} وحدة
                    </TText>
                  ) : null}

                  <View style={s.modalButtonsRow}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        title="أضف إلى السلة"
                        onPress={handleAddToCart}
                        disabled={!allGroupsValid}
                        variant="outline"
                        style={{ borderColor: BRAND_ORANGE, marginTop: spacing.md }}
                        textStyle={{ color: BRAND_ORANGE }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        title="إنشاء طلبية"
                        onPress={handleProceedToCheckoutForm}
                        disabled={!allGroupsValid}
                        style={{ marginTop: spacing.md, backgroundColor: BRAND_ORANGE }}
                      />
                    </View>
                  </View>
                </ScrollView>
              </>
            )}

            {step === 'CHECKOUT_FORM' && (
              <>
                <View style={s.modalHeader}>
                  <TText style={s.modalTitle}>معلومات الشحن والتوصيل</TText>
                  <Pressable onPress={() => setModalVisible(false)} hitSlop={10}>
                    <MaterialIcons name="close" size={22} color={colors.charcoalText} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <TText style={s.modalLabel}>الاسم واللقب</TText>
                  <LTextInput
                    style={s.textInputSingle}
                    placeholder="أدخل الاسم واللقب"
                    placeholderTextColor={colors.outline}
                    value={fullName}
                    onChangeText={setFullName}
                    textAlign="right"
                  />

                  <TText style={s.modalLabel}>رقم الهاتف</TText>
                  <LTextInput
                    style={s.textInputSingle}
                    placeholder="05XXXXXXXX"
                    placeholderTextColor={colors.outline}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    textAlign="right"
                  />

                  <TText style={s.modalLabel}>طريقة التوصيل</TText>
                  <View style={s.deliveryOptionsRow}>
                    <Pressable
                      style={[
                        s.deliveryOptionChip,
                        deliveryType === 'home' && s.deliveryOptionChipActive,
                      ]}
                      onPress={() => setDeliveryType('home')}
                    >
                      <MaterialIcons
                        name="home"
                        size={18}
                        color={deliveryType === 'home' ? BRAND_ORANGE : colors.outline}
                      />
                      <TText
                        style={[
                          s.deliveryOptionText,
                          deliveryType === 'home' && s.deliveryOptionTextActive,
                        ]}
                      >
                        توصيل للمنزل
                      </TText>
                    </Pressable>

                    <Pressable
                      style={[
                        s.deliveryOptionChip,
                        deliveryType === 'office' && s.deliveryOptionChipActive,
                      ]}
                      onPress={() => setDeliveryType('office')}
                    >
                      <MaterialIcons
                        name="store"
                        size={18}
                        color={deliveryType === 'office' ? BRAND_ORANGE : colors.outline}
                      />
                      <TText
                        style={[
                          s.deliveryOptionText,
                          deliveryType === 'office' && s.deliveryOptionTextActive,
                        ]}
                      >
                        توصيل لمكتب التوصيل
                      </TText>
                    </Pressable>
                  </View>

                  <TText style={s.modalLabel}>الولاية</TText>
                  <Pressable
                    style={s.dropdownSelector}
                    onPress={() => {
                      setWilayaDropdownOpen(!wilayaDropdownOpen);
                      setCommuneDropdownOpen(false);
                    }}
                  >
                    <TText style={selectedWilaya ? s.dropdownTextSelected : s.dropdownTextPlaceholder}>
                      {selectedWilaya ? getLocalizedLocationName(selectedWilaya.name, language) : 'اختر الولاية (69 ولاية)'}
                    </TText>
                    <MaterialIcons name="arrow-drop-down" size={24} color={colors.outline} />
                  </Pressable>

                  {wilayaDropdownOpen && (
                    <View style={s.dropdownListContainer}>
                      <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                        {ALGERIA_WILAYAS.map((w) => (
                          <Pressable
                            key={w.id}
                            style={s.dropdownItem}
                            onPress={() => {
                              setSelectedWilaya(w);
                              setSelectedCommune(null);
                              setWilayaDropdownOpen(false);
                            }}
                          >
                            <TText style={s.dropdownItemText}>{String(w.id).padStart(2, '0')} - {getLocalizedLocationName(w.name, language)}</TText>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {selectedWilaya && (
                    <>
                      <TText style={s.modalLabel}>البلدية</TText>
                      <Pressable
                        style={s.dropdownSelector}
                        onPress={() => setCommuneDropdownOpen(!communeDropdownOpen)}
                      >
                        <TText style={selectedCommune ? s.dropdownTextSelected : s.dropdownTextPlaceholder}>
                          {selectedCommune ? getLocalizedLocationName(selectedCommune, language) : 'اختر البلدية التابعة للولاية'}
                        </TText>
                        <MaterialIcons name="arrow-drop-down" size={24} color={colors.outline} />
                      </Pressable>

                      {communeDropdownOpen && (
                        <View style={s.dropdownListContainer}>
                          <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                            {selectedWilaya.communes.map((c, i) => (
                              <Pressable
                                key={i}
                                style={s.dropdownItem}
                                onPress={() => {
                                  setSelectedCommune(c);
                                  setCommuneDropdownOpen(false);
                                }}
                              >
                                <TText style={s.dropdownItemText}>{getLocalizedLocationName(c, language)}</TText>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </>
                  )}

                  {deliveryType === 'home' && (
                    <>
                      <TText style={s.modalLabel}>الشارع / الحي</TText>
                      <LTextInput
                        style={s.textInputSingle}
                        placeholder="أدخل اسم الشارع أو الحي ورقم المنزل"
                        placeholderTextColor={colors.outline}
                        value={streetAddress}
                        onChangeText={setStreetAddress}
                        textAlign="right"
                      />
                    </>
                  )}

                  {formError ? <TText style={s.validationError}>{formError}</TText> : null}

                  <PrimaryButton
                    title="استمرار"
                    onPress={handleContinueToOtp}
                    loading={submittingOrder}
                    disabled={submittingOrder}
                    style={{ marginTop: spacing.lg, backgroundColor: BRAND_ORANGE }}
                  />
                </ScrollView>
              </>
            )}

            {step === 'SUCCESS' && (
              <View style={s.successBox}>
                <View style={s.successIcon}>
                  <MaterialIcons name="check-circle" size={54} color={colors.success} />
                </View>
                <TText style={s.successTitle}>تم إنشاء طلبية بنجاح!</TText>
                <TText style={s.successSub}>
                  تم تسجيل طلبك ومعالجته بنجاح، سنتواصل معك قريباً لتأكيد التوصيل.
                </TText>
                <PrimaryButton title="الذهاب إلى السلة" variant="navy" onPress={goToCart} />
                <PrimaryButton
                  title="متابعة التسوق"
                  variant="outline"
                  onPress={continueShopping}
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceContainerHighest },

  supplierHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeIconImage: { width: 34, height: 34, borderRadius: 17 },
  storeIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD0A0',
  },
  supplierTitle: {
    ...typography.titleMd,
    fontSize: 16,
    color: '#0D5C75',
    fontWeight: '800',
  },
  supplierRatingBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  supplierRatingText: { fontSize: 12, color: colors.charcoalText, fontWeight: '700' },

  productTitle: {
    ...typography.titleMd,
    fontSize: 15,
    lineHeight: 22,
    color: colors.charcoalText,
    textAlign: 'right',
    marginTop: 2,
  },
  productDescription: {
    fontSize: 12,
    lineHeight: 19,
    color: colors.outline,
    textAlign: 'right',
    marginTop: 2,
  },
  salesRatingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingNum: { fontSize: 12, fontWeight: '700', color: colors.charcoalText },
  salesText: { ...typography.bodySm, fontSize: 12, color: colors.outline, marginRight: 6 },

  priceCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  priceTopHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discountBadge: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  discountBadgeText: { fontSize: 11, fontWeight: '700', color: '#137333' },
  strikethroughPrice: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.outline,
    textDecorationLine: 'line-through',
  },
  soldBadgeText: { fontSize: 11, color: colors.outline },

  mainPriceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 4,
  },
  mainPriceCurrency: { fontSize: 18, fontWeight: '800', color: BRAND_ORANGE },
  mainPriceVal: { fontSize: 24, fontWeight: '800', color: BRAND_ORANGE },

  guaranteesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  guaranteePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    width: '48%',
  },
  guaranteePillText: { fontSize: 11, fontWeight: '600', color: colors.charcoalText },

  sectionTitle: { ...typography.titleMd, fontSize: 15, color: colors.charcoalText, textAlign: 'right' },
  optionPromptCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionPromptContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  slidersIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionPromptTitle: { fontSize: 13, fontWeight: '700', color: colors.charcoalText, textAlign: 'right' },
  optionPromptSub: { fontSize: 11, color: colors.outline, textAlign: 'right', marginTop: 1 },

  shippingCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  shippingDetailRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shippingLabel: { fontSize: 12, color: colors.outline, textAlign: 'right' },
  shippingValHighlight: { fontSize: 12, fontWeight: '700', color: BRAND_ORANGE, textAlign: 'left' },

  reviewCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  reviewCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  reviewAuthorRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mistGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '700', color: colors.charcoalText },
  reviewAuthorName: { fontSize: 12, fontWeight: '700', color: colors.charcoalText, textAlign: 'right' },
  verifiedBadge: {
    backgroundColor: '#E6F4EA',
    borderRadius: radius.xs,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: 'flex-end',
  },
  verifiedBadgeText: { fontSize: 9, color: '#137333', fontWeight: '700' },
  reviewDate: { fontSize: 10, color: colors.outline },
  reviewBodyText: { fontSize: 12, color: colors.charcoalText, textAlign: 'right', lineHeight: 18 },

  masonryContainer: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  masonryColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  similarCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    ...cardShadow.level1,
  },
  similarImageHolder: {
    backgroundColor: colors.mistGray,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  similarImage: {
    width: '100%',
    height: '100%',
  },
  cardDiscountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cardDiscountText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  cardFavBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow.level1,
  },
  similarCardContent: {
    padding: spacing.xs + 2,
    gap: 4,
  },
  similarTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoalText,
    textAlign: 'right',
  },
  cardRatingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
  },
  cardRatingText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.charcoalText,
  },
  cardPriceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
  },
  similarPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND_ORANGE,
  },
  similarOldPrice: {
    fontSize: 11,
    color: colors.outline,
    textDecorationLine: 'line-through',
  },
  footerSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderColor: colors.outlineVariant,
    ...cardShadow.level2,
  },
  footerContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  cartIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  cartIconLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND_ORANGE,
    marginTop: 2,
  },
  globalOrderBtn: {
    flex: 1,
    backgroundColor: BRAND_ORANGE,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    gap: spacing.xs,
    ...cardShadow.level1,
  },
  globalOrderBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.titleMd,
    fontSize: 16,
    color: colors.charcoalText,
    textAlign: 'right',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoalText,
    textAlign: 'right',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  notesInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
    color: colors.charcoalText,
    fontSize: 13,
  },
  textInputSingle: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: colors.charcoalText,
    fontSize: 13,
  },
  deliveryOptionsRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: 4,
  },
  deliveryOptionChip: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    backgroundColor: '#F8F9FA',
  },
  deliveryOptionChipActive: {
    borderColor: BRAND_ORANGE,
    backgroundColor: '#FFF3E0',
  },
  deliveryOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.outline,
  },
  deliveryOptionTextActive: {
    color: BRAND_ORANGE,
    fontWeight: '700',
  },
  dropdownSelector: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 11,
  },
  dropdownTextSelected: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoalText,
    textAlign: 'right',
  },
  dropdownTextPlaceholder: {
    fontSize: 13,
    color: colors.outline,
    textAlign: 'right',
  },
  dropdownListContainer: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'flex-end',
  },
  dropdownItemText: {
    fontSize: 13,
    color: colors.charcoalText,
    textAlign: 'right',
  },
  otpInstructionText: {
    fontSize: 13,
    color: colors.outline,
    textAlign: 'center',
    lineHeight: 20,
  },
  validationError: {
    color: colors.error || '#D93025',
    fontSize: 12,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  modalButtonsRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  successIcon: {
    marginBottom: spacing.xs,
  },
  successTitle: {
    ...typography.titleMd,
    fontSize: 18,
    color: colors.charcoalText,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13,
    color: colors.outline,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
});