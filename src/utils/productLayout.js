// أداة توزيع مشتركة تُستعمل في أكثر من شاشة (الصفحة الرئيسية، البحث بالصورة)
// لضمان نفس شكل شبكة بطاقات المنتجات (توزيع "جشع" متوازن بين عمودين).

import { getCardImageHeight } from '../components/ProductCard';

const CARD_CHROME_HEIGHT = 72;
const RATING_ROW_HEIGHT = 18;

function estimateCardHeight(product) {
  const ratingExtra = typeof product.rating === 'number' ? RATING_ROW_HEIGHT : 0;
  return getCardImageHeight(product) + CARD_CHROME_HEIGHT + ratingExtra;
}

/**
 * يوزّع قائمة منتجات بين عمودين بطريقة "جشعة": كل منتج يذهب للعمود الأقصر
 * حالياً، ليبقى العمودان متوازنين بصرياً.
 */
export function splitIntoBalancedColumns(products) {
  const columnA = [];
  const columnB = [];
  let heightA = 0;
  let heightB = 0;
  products.forEach((product) => {
    const estimatedHeight = estimateCardHeight(product);
    if (heightA <= heightB) {
      columnA.push(product);
      heightA += estimatedHeight;
    } else {
      columnB.push(product);
      heightB += estimatedHeight;
    }
  });
  return { columnA, columnB };
}
