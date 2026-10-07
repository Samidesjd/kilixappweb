import { TText } from '../context/LanguageContext';
import React from 'react';
import { View, Pressable, Image, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { useFavorites } from '../context/FavoritesContext';

// ارتفاعات مختلفة لصور البطاقات باش نحصلو على تأثير "waterfall" عضوي بدل شبكة موحّدة الطول،
// بنفس روح تطبيق Alibaba. الاختيار ثابت لكل منتج (مبني على معرّفه) باش ما يتبدلش عشوائياً
// فكل إعادة رسم (re-render) أو عند تغيير التصنيف.
// تم زيادة الارتفاعات قليلاً لزيادة مساحة الصورة مع الحفاظ على التوازن
const IMAGE_HEIGHT_VARIANTS = [165, 185, 210, 175, 195, 160];

function hashProductId(id) {
  const str = String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getCardImageHeight(product) {
  return IMAGE_HEIGHT_VARIANTS[hashProductId(product.id) % IMAGE_HEIGHT_VARIANTS.length];
}

// بطاقة منتج مبسّطة للصفحة الرئيسية: صورة، اسم، السعر الحالي، السعر القديم (إن وجد خصم)،
// شارة الخصم (إن وجدت)، التقييم (اختياري)، زر المفضلة.
// كل معلومات المنتج الكاملة (المورد، الحد الأدنى للطلب، الخيارات...) تظهر فقط داخل صفحة التفاصيل.
// React.memo: يمنع إعادة رسم بطاقة المنتج عند إعادة رسم القائمة الأم
// طالما لم تتغيّر خصائصها (product, onPress) — مهم جداً لأداء قوائم/شبكات المنتجات
const ProductCard = React.memo(function ProductCard({ product, onPress }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(product.id);
  const hasDiscount = !!product.oldPrice && product.oldPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;
  const imageHeight = getCardImageHeight(product);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: product.image }} style={[styles.image, { height: imageHeight }]} resizeMode="cover" />
        {hasDiscount ? (
          <View style={styles.discountBadge}>
            <TText style={styles.discountText}>خصم {discountPct}٪</TText>
          </View>
        ) : null}
        <Pressable
          style={styles.favBtn}
          hitSlop={10}
          onPress={(e) => {
            e.stopPropagation?.();
            toggleFavorite(product.id);
          }}
        >
          <MaterialIcons
            name={fav ? 'favorite' : 'favorite-border'}
            size={18}
            color={fav ? colors.orangeVibrant : colors.onSurfaceVariant}
          />
        </Pressable>
      </View>

      <TText style={styles.productName} numberOfLines={2}>{product.title}</TText>

      {typeof product.rating === 'number' ? (
        <View style={styles.ratingRow}>
          <MaterialIcons name="star" size={14} color="#F5A623" />
          <TText style={styles.ratingText}>{product.rating.toFixed(1)}</TText>
        </View>
      ) : null}

      <View style={styles.priceRow}>
        <TText style={styles.price}>{product.price.toLocaleString('en-US')} {product.currency}</TText>
        {hasDiscount ? (
          <TText style={styles.oldPrice}>{product.oldPrice.toLocaleString('en-US')} {product.currency}</TText>
        ) : null}
      </View>
    </Pressable>
  );
});

export default ProductCard;

const styles = StyleSheet.create({
  card: {
    ...cardShadow.level1,
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xs + 2,
    overflow: 'hidden',
  },
  imageWrap: { position: 'relative', marginBottom: spacing.xs + 1 },
  image: {
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
  },
  discountBadge: {
    position: 'absolute',
    top: spacing.xs + 2,
    right: spacing.xs + 2,
    backgroundColor: colors.orangeVibrant,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  discountText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  favBtn: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: { ...typography.bodySm, fontSize: 12.5, lineHeight: 17, fontWeight: '700', color: colors.charcoalText, textAlign: 'right', paddingHorizontal: spacing.xs },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 3, paddingHorizontal: spacing.xs },
  ratingText: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant },
  priceRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, marginTop: 3, paddingHorizontal: spacing.xs, flexWrap: 'wrap' },
  price: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.charcoalText, textAlign: 'right', flexShrink: 1 },
  oldPrice: { fontSize: 11, lineHeight: 15, color: colors.outline, textDecorationLine: 'line-through', flexShrink: 1 },
});
