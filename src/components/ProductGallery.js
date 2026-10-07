import React, { useState, useRef, useCallback } from 'react';
import { View, Image, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/theme';

// معرض صور احترافي وقابل لإعادة الاستخدام لأي منتج (صورة واحدة أو عدة صور).
// - يعرض كل صورة كاملة بدون قص (resizeMode="contain").
// - تمرير أفقي سلس مع مؤشرات صفحات (dots).
// - يتكيف تلقائياً مع عرض الشاشة (responsive).
export default function ProductGallery({ images = [], style }) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);

  const safeImages = images && images.length > 0 ? images : [null];

  const onScroll = useCallback(
    (e) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / width);
      if (index !== activeIndex) setActiveIndex(index);
    },
    [width, activeIndex]
  );

  return (
    <View style={[styles.container, style]}>
      <FlatList
        ref={listRef}
        data={safeImages}
        horizontal
        pagingEnabled
        inverted={I18nManagerSafeInverted()}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            {item ? (
              <Image source={{ uri: item }} style={styles.image} resizeMode="contain" />
            ) : (
              <View style={styles.placeholder}>
                <MaterialIcons name="inventory-2" size={48} color={colors.outlineVariant} />
              </View>
            )}
          </View>
        )}
      />

      {safeImages.length > 1 ? (
        <View style={styles.dotsRow}>
          {safeImages.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// FlatList مع pagingEnabled أفقي داخل تطبيق RTL بالكامل (I18nManager.forceRTL) يتمرر
// أصلاً من اليمين لليسار تلقائياً على iOS/Android بدون الحاجة لعكس إضافي، فنخليها false
// دائماً لتفادي ازدواجية الاتجاه (كان يسبب صور "مقلوبة الترتيب" جزئياً مخفية).
function I18nManagerSafeInverted() {
  return false;
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  slide: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(45,45,45,0.22)' },
  dotActive: { width: 18, backgroundColor: colors.orangeVibrant },
});
