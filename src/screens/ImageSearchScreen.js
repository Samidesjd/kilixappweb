import { TText, LTextInput, useLocalizedAlert } from '../context/LanguageContext';
// شاشة البحث بالصورة: تطلب صلاحية الوصول للمعرض/الكاميرا، تعرض الصورة المختارة
// في الأعلى، تُظهر حالة التحليل، ثم تعرض المنتجات المشابهة.

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, typography, cardShadow, sizes } from '../theme/theme';
import { mapSupabaseProductRecord } from '../hooks/useFirestoreProducts';
import { splitIntoBalancedColumns } from '../utils/productLayout';
import * as ImageManipulator from 'expo-image-manipulator';
import { computeMultimodalImageEmbedding, computeImageEmbedding, searchProductsByVisualEmbedding } from '../utils/imageEmbeddingSearch';

import ProductCard from '../components/ProductCard';

// حالات الشاشة
const STATES = {
  IDLE: 'idle',           // الحالة الأولية: اختيار مصدر الصورة
  EDITOR: 'editor',       // تحديد أبعاد الصورة وما الذي نبحث عنه
  ANALYZING: 'analyzing', // جاري تحليل الصورة والبحث عن التشابه البصري
  RESULTS: 'results',     // عرض النتائج
  ERROR: 'error',         // خطأ في التحليل
  EMPTY: 'empty',         // لا توجد نتائج
};

// أقصى عدد نتائج نعرضها للمستخدم
const MAX_RESULTS = 12;

export default function ImageSearchScreen({ navigation }) {
  const showLocalizedAlert = useLocalizedAlert();
  const { width } = useWindowDimensions();

  const [screenState, setScreenState] = useState(STATES.IDLE);
  const [selectedImage, setSelectedImage] = useState(null); // { uri, width, height }
  const [searchAspect, setSearchAspect] = useState('1:1');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // ── حساب ارتفاع معاينة الصورة ────────────────────────────────────────────
  const imagePreviewHeight = Math.min(width * 0.65, 280);
  const editorAspectRatio = searchAspect === 'original'
    ? (selectedImage?.width && selectedImage?.height ? selectedImage.width / selectedImage.height : 1)
    : Number(String(searchAspect).split(':')[0]) / Number(String(searchAspect).split(':')[1]);

  // ── توزيع نتائج البحث بين عمودين بنفس طريقة الصفحة الرئيسية بالضبط ────────
  const { columnA: resultsColumnA, columnB: resultsColumnB } = useMemo(
    () => splitIntoBalancedColumns(results),
    [results]
  );

  // ── استئذان المعرض ────────────────────────────────────────────────────────
  const requestGalleryPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status === 'granted') return true;
    if (status === 'denied') {
      setPermissionDenied(true);
      showLocalizedAlert(
        'صلاحية الوصول مرفوضة',
        'يحتاج البحث بالصورة إلى الوصول لمعرض الصور. يُرجى تفعيل الصلاحية من إعدادات الجهاز.',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'فتح الإعدادات', onPress: () => Linking.openSettings() },
        ]
      );
    }
    return false;
  }, []);

  // ── استئذان الكاميرا ──────────────────────────────────────────────────────
  const requestCameraPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status === 'granted') return true;
    if (status === 'denied') {
      setPermissionDenied(true);
      showLocalizedAlert(
        'صلاحية الكاميرا مرفوضة',
        'يحتاج البحث بالصورة إلى استخدام الكاميرا. يُرجى تفعيل الصلاحية من إعدادات الجهاز.',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'فتح الإعدادات', onPress: () => Linking.openSettings() },
        ]
      );
    }
    return false;
  }, []);

  // ── معالجة الصورة المختارة: تشابه بصري دلالي، مع fallback لوني عند تعذر الخدمة ──
  const processImage = useCallback(
    async (uri, sourceDimensions, aspect, queryText) => {
      setSelectedImage({ uri, width: sourceDimensions?.width || null, height: sourceDimensions?.height || null });
      setScreenState(STATES.ANALYZING);
      setPermissionDenied(false);

      try {
        // 1) نطبق نسبة القص التي اختارها المستخدم، ثم نصغّر الصورة ونحوّلها إلى base64.
        const width = Number(sourceDimensions?.width) || 0;
        const height = Number(sourceDimensions?.height) || 0;
        const cropRatio = aspect === 'original' ? null : Number(String(aspect).split(':')[0]) / Number(String(aspect).split(':')[1]);
        let cropAction = null;

        if (width > 0 && height > 0 && cropRatio && Number.isFinite(cropRatio)) {
          const sourceRatio = width / height;
          if (Math.abs(sourceRatio - cropRatio) > 0.01) {
            if (sourceRatio > cropRatio) {
              const cropWidth = Math.max(1, Math.round(height * cropRatio));
              cropAction = { crop: { originX: Math.round((width - cropWidth) / 2), originY: 0, width: cropWidth, height } };
            } else {
              const cropHeight = Math.max(1, Math.round(width / cropRatio));
              cropAction = { crop: { originX: 0, originY: Math.round((height - cropHeight) / 2), width, height: cropHeight } };
            }
          }
        }

        const actions = [];
        if (cropAction) actions.push(cropAction);
        actions.push({ resize: { width: 768 } });

        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          actions,
          { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 0.82 }
        );
        if (!manipulated?.base64) throw new Error('تعذّر تجهيز الصورة للبحث');

        // 2) نستخدم Gemini Multimodal كمسار أساسي. لا نحسب المحرك القديم إلا عند الحاجة،
        // حتى لا نجعل طلب البحث ينتظر خدمتين متتاليتين.
        let matched = [];
        try {
          try {
            const multimodalQueryEmbedding = await computeMultimodalImageEmbedding(manipulated.base64);
            matched = await searchProductsByVisualEmbedding([], null, MAX_RESULTS, {
              queryText,
              multimodalQueryEmbedding,
            });
          } catch (multimodalError) {
            // Only on service failure do we use the legacy semantic engine.
            // It is also server-indexed and never scans the client catalog.
            if (__DEV__) console.warn('[ImageSearch] multimodal engine unavailable, using semantic fallback:', multimodalError?.message || multimodalError);
            const semanticQueryEmbedding = await computeImageEmbedding(manipulated.base64, queryText);
            matched = await searchProductsByVisualEmbedding([], semanticQueryEmbedding, MAX_RESULTS, { queryText });
          }
        } catch (visualError) {
          if (__DEV__) console.warn('[ImageSearch] visual search failed:', visualError?.message || visualError);
        }


        // حماية أخيرة: المنتجات المؤرشفة لا تُعرض حتى لو وصلت من مسار قديم.
        matched = matched.filter((item) => item?.is_active !== false);

        if (matched.length === 0) {
          setScreenState(STATES.EMPTY);
        } else {
          setResults(matched.map((item) => item?.title ? item : mapSupabaseProductRecord(item)));
          setScreenState(STATES.RESULTS);
        }
      } catch (err) {
        if (__DEV__) console.error('[ImageSearchScreen] analysis error:', err);
        setScreenState(STATES.ERROR);
      }
    },
    []
  );

  // ── اختيار من المعرض ─────────────────────────────────────────────────────
  const pickFromGallery = useCallback(async () => {
    const granted = await requestGalleryPermission();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      setSelectedImage({ uri: asset.uri, width: asset.width || null, height: asset.height || null });
      setSearchAspect('1:1');
      setSearchQuery('');
      setScreenState(STATES.EDITOR);
    }
  }, [requestGalleryPermission, processImage]);

  // ── التقاط صورة ──────────────────────────────────────────────────────────
  const takePhoto = useCallback(async () => {
    const granted = await requestCameraPermission();
    if (!granted) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      setSelectedImage({ uri: asset.uri, width: asset.width || null, height: asset.height || null });
      setSearchAspect('1:1');
      setSearchQuery('');
      setScreenState(STATES.EDITOR);
    }
  }, [requestCameraPermission, processImage]);

  // ── تنفيذ البحث من شاشة تحديد الأبعاد والطلب النصي ────────────────────────
  const runSearch = useCallback(async () => {
    if (!selectedImage?.uri) return;
    await processImage(
      selectedImage.uri,
      { width: selectedImage.width, height: selectedImage.height },
      searchAspect,
      searchQuery.trim()
    );
  }, [processImage, searchAspect, searchQuery, selectedImage]);

  // ── إعادة الضبط ──────────────────────────────────────────────────────────
  const resetSearch = () => {
    setSelectedImage(null);
    setResults([]);
    setSearchAspect('1:1');
    setSearchQuery('');
    setScreenState(STATES.IDLE);
    setPermissionDenied(false);
  };

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={screenState === STATES.EDITOR ? resetSearch : () => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <MaterialIcons name="arrow-forward" size={24} color={colors.charcoalText} />
        </Pressable>
        <TText style={styles.headerTitle}>البحث بالصورة</TText>
        {screenState === STATES.EDITOR ? (
          <Pressable
            onPress={runSearch}
            hitSlop={8}
            style={({ pressed }) => [styles.searchHeaderBtn, pressed && styles.searchHeaderBtnPressed]}
          >
            <MaterialIcons name="search" size={19} color={colors.white} />
            <TText style={styles.searchHeaderText}>بحث</TText>
          </Pressable>
        ) : selectedImage ? (
          <Pressable onPress={resetSearch} hitSlop={10} style={styles.resetBtn}>
            <MaterialIcons name="refresh" size={22} color={colors.charcoalText} />
          </Pressable>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Image Preview (after selection / during analysis) ───────────── */}
        {selectedImage && screenState !== STATES.EDITOR && (
          <View style={styles.imagePreviewWrap}>
            <Image
              source={{ uri: selectedImage.uri }}
              style={[styles.imagePreview, { height: imagePreviewHeight }]}
              resizeMode="cover"
            />
            {screenState !== STATES.ANALYZING && (
              <Pressable style={styles.changeImageBtn} onPress={resetSearch}>
                <MaterialIcons name="photo-camera" size={14} color={colors.white} />
                <TText style={styles.changeImageText}>تغيير الصورة</TText>
              </Pressable>
            )}
          </View>
        )}

        {/* ── EDITOR: choose dimensions + optional exact search focus ─────── */}
        {screenState === STATES.EDITOR && selectedImage && (
          <View style={styles.editorContent}>
            <View style={[styles.editorImageCard, { height: Math.min(width * 0.92, 390) }]}>
              <Image source={{ uri: selectedImage.uri }} style={styles.editorImage} resizeMode="contain" />
              <View style={[styles.editorCropFrame, { aspectRatio: editorAspectRatio }]}>
                <View style={styles.cropCornerTopRight} />
                <View style={styles.cropCornerTopLeft} />
                <View style={styles.cropCornerBottomRight} />
                <View style={styles.cropCornerBottomLeft} />
              </View>
            </View>

            <View style={styles.dimensionsRow}>
              <View style={styles.dimensionBadge}>
                <MaterialIcons name="photo-size-select-large" size={18} color={colors.charcoalText} />
                <TText style={styles.dimensionText}>
                  {selectedImage.width && selectedImage.height ? `${selectedImage.width} × ${selectedImage.height}` : 'الأبعاد الأصلية'}
                </TText>
              </View>
              <TText style={styles.editorHint}>حدد أبعاد الصورة قبل البحث</TText>
            </View>

            <View style={styles.sectionCard}>
              <TText style={styles.editorSectionTitle}>أبعاد البحث</TText>
              <View style={styles.aspectRow}>
                {[
                  ['1:1', 'مربع'],
                  ['4:3', 'قياسي'],
                  ['16:9', 'عريض'],
                  ['original', 'أصلي'],
                ].map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => setSearchAspect(value)}
                    style={[styles.aspectBtn, searchAspect === value && styles.aspectBtnActive]}
                  >
                    <TText style={[styles.aspectValue, searchAspect === value && styles.aspectTextActive]}>{value === 'original' ? 'أصلي' : value}</TText>
                    <TText style={[styles.aspectLabel, searchAspect === value && styles.aspectTextActive]}>{label}</TText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <TText style={styles.editorSectionTitle}>ما الذي تبحث عنه تحديدًا؟</TText>
              <View style={styles.queryInputWrap}>
                <MaterialIcons name="search" size={21} color={colors.outline} />
                <LTextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="مثال: حقيبة سوداء جلدية"
                  placeholderTextColor={colors.outline}
                  style={styles.queryInput}
                  textAlign="right"
                  returnKeyType="search"
                  onSubmitEditing={runSearch}
                />
              </View>
              <TText style={styles.queryHint}>اختياري: اكتب نوع المنتج أو اللون أو أي تفصيل تريد التركيز عليه.</TText>
            </View>

            <Pressable style={styles.editorSearchBtn} onPress={runSearch}>
              <MaterialIcons name="search" size={21} color={colors.white} />
              <TText style={styles.editorSearchText}>بحث بهذه الصورة</TText>
            </Pressable>
          </View>
        )}

        {/* ── IDLE: pick source ───────────────────────────────────────────── */}
        {screenState === STATES.IDLE && (
          <View style={styles.idleContent}>
            {/* Illustration */}
            <View style={styles.illustrationCircle}>
              <MaterialIcons name="image-search" size={48} color={colors.charcoalText} />
            </View>

            <TText style={styles.idleTitle}>ابحث بصورة منتج</TText>
            <TText style={styles.idleBody}>
              التقط صورة أو اختر من معرضك للعثور على منتجات مشابهة في كتالوج Kilix.
            </TText>

            {/* Permission denied state */}
            {permissionDenied && (
              <View style={styles.permissionDeniedCard}>
                <MaterialIcons name="block" size={20} color={colors.error} />
                <View style={{ flex: 1 }}>
                  <TText style={styles.permissionDeniedTitle}>الصلاحية مرفوضة</TText>
                  <TText style={styles.permissionDeniedBody}>
                    يتطلب البحث بالصورة الوصول إلى المعرض أو الكاميرا. افتح إعدادات الجهاز لتفعيل الصلاحية.
                  </TText>
                  <Pressable onPress={() => Linking.openSettings()} style={styles.openSettingsBtn}>
                    <TText style={styles.openSettingsText}>فتح الإعدادات</TText>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Source buttons */}
            <View style={styles.sourceButtons}>
              <Pressable
                style={({ pressed }) => [styles.sourceBtn, pressed && styles.sourceBtnPressed]}
                onPress={pickFromGallery}
              >
                <View style={styles.sourceBtnIcon}>
                  <MaterialIcons name="photo-library" size={24} color={colors.charcoalText} />
                </View>
                <TText style={styles.sourceBtnLabel}>معرض الصور</TText>
                <TText style={styles.sourceBtnSub}>اختر من ألبوماتك</TText>
              </Pressable>

              <View style={styles.sourceDivider} />

              <Pressable
                style={({ pressed }) => [styles.sourceBtn, pressed && styles.sourceBtnPressed]}
                onPress={takePhoto}
              >
                <View style={styles.sourceBtnIcon}>
                  <MaterialIcons name="photo-camera" size={24} color={colors.charcoalText} />
                </View>
                <TText style={styles.sourceBtnLabel}>الكاميرا</TText>
                <TText style={styles.sourceBtnSub}>التقط صورة جديدة</TText>
              </Pressable>
            </View>

            <TText style={styles.hint}>
              للحصول على أفضل نتائج، استخدم صورة واضحة للمنتج على خلفية بيضاء أو مُحايدة.
            </TText>
          </View>
        )}

        {/* ── ANALYZING state ─────────────────────────────────────────────── */}
        {screenState === STATES.ANALYZING && (
          <View style={styles.analyzingContent}>
            {/* Pulsing indicator */}
            <View style={styles.analyzingCircle}>
              <ActivityIndicator size="large" color={colors.orangeVibrant} />
            </View>
            <TText style={styles.analyzingTitle}>جاري تحليل الصورة...</TText>
            <TText style={styles.analyzingBody}>نبحث عن المنتجات المشابهة في الكتالوج</TText>

            {/* Step indicators */}
            <View style={styles.stepsRow}>
              <StepDot label="رفع الصورة" done />
              <View style={styles.stepLine} />
              <StepDot label="تحليل المحتوى" active />
              <View style={styles.stepLine} />
              <StepDot label="استخراج النتائج" />
            </View>
          </View>
        )}

        {/* ── RESULTS ─────────────────────────────────────────────────────── */}
        {screenState === STATES.RESULTS && (
          <View style={styles.resultsContent}>
            {/* Section header */}
            <View style={styles.resultsSectionHeader}>
              <View style={styles.resultsCountBadge}>
                <TText style={styles.resultsCountText}>{results.length}</TText>
              </View>
              <TText style={styles.resultsSectionTitle}>منتجات مشابهة</TText>
            </View>

            {/* شبكة منتجات بعمودين — نفس توزيع الصفحة الرئيسية بالضبط (بدون شريط تصنيفات) */}
            <View style={styles.productsGrid}>
              <View style={styles.productsColumn}>
                {resultsColumnA.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onPress={() => navigation.navigate('ProductDetail', { product: p })}
                  />
                ))}
              </View>
              <View style={styles.productsColumn}>
                {resultsColumnB.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onPress={() => navigation.navigate('ProductDetail', { product: p })}
                  />
                ))}
              </View>
            </View>

            {/* Try another image */}
            <Pressable style={styles.tryAnotherBtn} onPress={resetSearch}>
              <MaterialIcons name="photo-camera" size={16} color={colors.charcoalText} />
              <TText style={styles.tryAnotherText}>جرّب صورة أخرى</TText>
            </Pressable>
          </View>
        )}

        {/* ── EMPTY state ─────────────────────────────────────────────────── */}
        {screenState === STATES.EMPTY && (
          <View style={styles.emptyContent}>
            <View style={styles.emptyIconCircle}>
              <MaterialIcons name="search-off" size={40} color={colors.outlineVariant} />
            </View>
            <TText style={styles.emptyTitle}>لا توجد منتجات مشابهة</TText>
            <TText style={styles.emptyBody}>
              لم نتمكن من العثور على منتجات مشابهة لهذه الصورة. جرّب صورة أكثر وضوحاً أو زاوية مختلفة.
            </TText>
            <Pressable style={styles.tryAnotherBtn} onPress={resetSearch}>
              <MaterialIcons name="photo-camera" size={16} color={colors.charcoalText} />
              <TText style={styles.tryAnotherText}>جرّب صورة أخرى</TText>
            </Pressable>
          </View>
        )}

        {/* ── ERROR state ─────────────────────────────────────────────────── */}
        {screenState === STATES.ERROR && (
          <View style={styles.emptyContent}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.errorContainer }]}>
              <MaterialIcons name="error-outline" size={40} color={colors.error} />
            </View>
            <TText style={styles.emptyTitle}>تعذّر تحليل الصورة</TText>
            <TText style={styles.emptyBody}>
              حدث خطأ أثناء معالجة الصورة. تأكد من الاتصال بالإنترنت وحاول مجدداً.
            </TText>
            <Pressable style={styles.tryAnotherBtn} onPress={resetSearch}>
              <MaterialIcons name="refresh" size={16} color={colors.charcoalText} />
              <TText style={styles.tryAnotherText}>إعادة المحاولة</TText>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Step dot helper ───────────────────────────────────────────────────────────
function StepDot({ label, done = false, active = false }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={[
          stepStyles.dot,
          done && stepStyles.dotDone,
          active && stepStyles.dotActive,
        ]}
      >
        {done ? (
          <MaterialIcons name="check" size={10} color={colors.white} />
        ) : active ? (
          <View style={stepStyles.activePulse} />
        ) : null}
      </View>
      <TText style={[stepStyles.label, (done || active) && stepStyles.labelActive]}>
        {label}
      </TText>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.success },
  dotActive: { backgroundColor: colors.orangeVibrant },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  label: { ...typography.caption, color: colors.outline, textAlign: 'center' },
  labelActive: { color: colors.charcoalText, fontWeight: '700' },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    height: sizes.headerHeight,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    ...cardShadow.level1,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  headerTitle: {
    ...typography.titleSm,
    color: colors.charcoalText,
    textAlign: 'center',
    flex: 1,
  },
  searchHeaderBtn: {
    minWidth: 76,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.orangeVibrant,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  searchHeaderBtnPressed: { opacity: 0.82 },
  searchHeaderText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  resetBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },

  scrollContent: {
    paddingBottom: spacing.xl,
  },

  // Image preview (top of page after selection)
  imagePreviewWrap: {
    position: 'relative',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...cardShadow.level1,
  },
  imagePreview: {
    width: '100%',
    borderRadius: radius.xl,
    backgroundColor: colors.mistGray,
  },
  changeImageBtn: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  changeImageText: { ...typography.caption, color: colors.white, fontWeight: '700' },

  // IDLE state
  idleContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  illustrationCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  idleTitle: {
    ...typography.titleMd,
    color: colors.charcoalText,
    textAlign: 'center',
  },
  idleBody: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  permissionDeniedCard: {
    width: '100%',
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  permissionDeniedTitle: {
    ...typography.bodySm,
    fontWeight: '700',
    color: colors.error,
    textAlign: 'right',
  },
  permissionDeniedBody: {
    ...typography.caption,
    color: colors.charcoalText,
    textAlign: 'right',
    lineHeight: 18,
    marginTop: 2,
  },
  openSettingsBtn: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    backgroundColor: colors.error,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  openSettingsText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  sourceButtons: {
    width: '100%',
    flexDirection: 'row-reverse',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
    ...cardShadow.level1,
  },
  sourceBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  sourceBtnPressed: { backgroundColor: colors.surfaceContainerLow },
  sourceBtnIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  sourceBtnLabel: {
    ...typography.bodySm,
    fontWeight: '700',
    color: colors.charcoalText,
    textAlign: 'center',
  },
  sourceBtnSub: {
    ...typography.caption,
    color: colors.outline,
    textAlign: 'center',
  },
  sourceDivider: {
    width: 1,
    backgroundColor: colors.outlineVariant,
    marginVertical: spacing.md,
  },
  hint: {
    ...typography.caption,
    color: colors.outline,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginTop: spacing.xs,
  },

  // EDITOR
  editorContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  editorImageCard: {
    width: '100%',
    height: 390,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceContainerLow,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow.level1,
  },
  editorImage: {
    width: '100%',
    height: '100%',
  },
  editorCropFrame: {
    position: 'absolute',
    width: '82%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  cropCornerTopRight: { position: 'absolute', right: -1, top: -1, width: 28, height: 28, borderTopWidth: 3, borderRightWidth: 3, borderColor: colors.white },
  cropCornerTopLeft: { position: 'absolute', left: -1, top: -1, width: 28, height: 28, borderTopWidth: 3, borderLeftWidth: 3, borderColor: colors.white },
  cropCornerBottomRight: { position: 'absolute', right: -1, bottom: -1, width: 28, height: 28, borderBottomWidth: 3, borderRightWidth: 3, borderColor: colors.white },
  cropCornerBottomLeft: { position: 'absolute', left: -1, bottom: -1, width: 28, height: 28, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: colors.white },
  dimensionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dimensionBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dimensionText: { ...typography.caption, color: colors.charcoalText, fontWeight: '700' },
  editorHint: { ...typography.caption, color: colors.outline, flex: 1, textAlign: 'right' },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    gap: spacing.sm,
    ...cardShadow.level1,
  },
  editorSectionTitle: { ...typography.titleSm, color: colors.charcoalText, textAlign: 'right' },
  aspectRow: { flexDirection: 'row-reverse', gap: spacing.xs },
  aspectBtn: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  aspectBtnActive: { backgroundColor: colors.orangeVibrant, borderColor: colors.orangeVibrant },
  aspectValue: { ...typography.bodySm, color: colors.charcoalText, fontWeight: '700' },
  aspectLabel: { ...typography.caption, color: colors.outline, marginTop: 1 },
  aspectTextActive: { color: colors.white },
  queryInputWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.inputHeight,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: spacing.md,
  },
  queryInput: { flex: 1, ...typography.bodySm, color: colors.charcoalText, paddingVertical: 0 },
  queryHint: { ...typography.caption, color: colors.outline, textAlign: 'right', lineHeight: 18 },
  editorSearchBtn: {
    height: sizes.buttonHeight,
    borderRadius: radius.lg,
    backgroundColor: colors.orangeVibrant,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...cardShadow.level2,
  },
  editorSearchText: { ...typography.bodySm, color: colors.white, fontWeight: '700' },

  // ANALYZING state
  analyzingContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  analyzingCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.orangeTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.orangeTintBorder,
  },
  analyzingTitle: {
    ...typography.titleSm,
    color: colors.charcoalText,
    textAlign: 'center',
  },
  analyzingBody: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  stepsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: 4,
  },
  stepLine: {
    width: 28,
    height: 1.5,
    backgroundColor: colors.outlineVariant,
  },

  // RESULTS
  resultsContent: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  resultsSectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  resultsCountBadge: {
    backgroundColor: colors.orangeTint,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.orangeTintBorder,
  },
  resultsCountText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.charcoalText,
  },
  resultsSectionTitle: {
    ...typography.titleSm,
    color: colors.charcoalText,
  },
  productsGrid: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  productsColumn: { flex: 1, gap: spacing.xs },

  tryAnotherBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  tryAnotherText: {
    ...typography.bodySm,
    fontWeight: '700',
    color: colors.charcoalText,
  },

  // EMPTY / ERROR states
  emptyContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.titleSm,
    color: colors.charcoalText,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
});
