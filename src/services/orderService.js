import { supabase } from '../config/supabaseConfig';
import { ORDER_STATUS } from '../constants/orderStatus';

const mapOrder = (row) => ({
  id: row.id,
  productId: row.product_id,
  storeId: row.store_id,
  title: row.product_title,
  qty: Number(row.quantity) || 0,
  qtyUnit: row.quantity_unit || 'قطعة',
  date: row.created_at,
  status: row.status,
  total: Number(row.total_price) || 0,
  unitPrice: Number(row.unit_price) || 0,
  currency: row.currency || 'دج',
  category: row.category || '',
  image: row.image_url || null,
  customerId: row.user_id,
  customerName: row.customer_name,
  phone: row.phone,
  deliveryType: row.delivery_type,
  wilaya: row.wilaya,
  commune: row.commune,
  streetAddress: row.street_address,
  notes: row.notes || '',
  details: Array.isArray(row.details) ? row.details : [],
  reviewed: !!row.reviewed,
  raw: row,
});

export async function createOrder({ storeId, productId, customerName, phone, deliveryType, wilaya, commune, streetAddress, notes, quantity, details }) {
  const { data, error } = await supabase.rpc('create_order', {
    p_store_id: storeId,
    p_product_id: productId,
    p_customer_name: customerName,
    p_phone: phone,
    p_delivery_type: deliveryType,
    p_wilaya: wilaya,
    p_commune: commune,
    p_street_address: streetAddress || null,
    p_notes: notes || '',
    p_quantity: quantity,
    p_details: details || [],
  });
  if (error) throw error;
  return mapOrder(data);
}

export async function getMyOrders(userId, { limit = 50, offset = 0 } = {}) {
  if (!userId) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const { data, error } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }).range(safeOffset, safeOffset + safeLimit - 1);
  if (error) throw error;
  return (data || []).map(mapOrder);
}

export async function getStoreOrders(storeId, { limit = 50, offset = 0 } = {}) {
  if (!storeId) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const { data, error } = await supabase.from('orders').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).range(safeOffset, safeOffset + safeLimit - 1);
  if (error) throw error;
  return (data || []).map(mapOrder);
}

export async function merchantUpdateOrderStatus(orderId, status) {
  if (![ORDER_STATUS.SHIPPING, ORDER_STATUS.OUT_OF_STOCK, ORDER_STATUS.CANCELLED].includes(status)) {
    throw new Error('حالة الطلب غير صالحة للتاجر');
  }
  const { data, error } = await supabase.rpc('merchant_update_order_status', { p_order_id: orderId, p_new_status: status });
  if (error) throw error;
  return mapOrder(data);
}

export async function confirmOrderReceived(orderId) {
  const { data, error } = await supabase.rpc('confirm_order_received', { p_order_id: orderId });
  if (error) throw error;
  return mapOrder(data);
}

export default { createOrder, getMyOrders, getStoreOrders, merchantUpdateOrderStatus, confirmOrderReceived };
