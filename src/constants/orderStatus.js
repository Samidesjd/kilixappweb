export const ORDER_STATUS = {
  PENDING: 'pending',
  SHIPPING: 'shipping',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  OUT_OF_STOCK: 'out_of_stock',
  CANCELLED: 'cancelled',
};

export const ORDER_STATUS_LABELS = {
  pending: 'قيد الانتظار',
  shipping: 'قيد الشحن',
  delivered: 'تم الاستلام',
  completed: 'مكتمل',
  out_of_stock: 'نفد المخزون',
  cancelled: 'ملغاة',
};

export const ORDER_STATUS_COLOR_KEY = {
  pending: 'warning',
  shipping: 'info',
  delivered: 'info',
  completed: 'success',
  out_of_stock: 'error',
  cancelled: 'error',
};

export const ORDER_TABS = [
  { key: 'all', label: 'الكل' },
  { key: ORDER_STATUS.PENDING, label: 'قيد الانتظار' },
  { key: ORDER_STATUS.SHIPPING, label: 'قيد الشحن' },
  { key: ORDER_STATUS.COMPLETED, label: 'مكتمل' },
];
