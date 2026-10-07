import { supabase } from '../config/supabaseConfig';

export const BILLING_RATE = 0.003;
export const BILLING_THRESHOLD = 500;

export async function getBillingSummary(storeId) {
  const { data, error } = await supabase.rpc('get_store_billing_summary', { p_store_id: storeId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || {
    store_id: storeId,
    gross_order_value: 0,
    fee_rate: BILLING_RATE,
    accumulated_fee: 0,
    paid_fee: 0,
    outstanding_fee: 0,
    payment_threshold: BILLING_THRESHOLD,
    payment_required: false,
  };
}

export async function getPaymentHistory(storeId) {
  const { data, error } = await supabase.from('merchant_payments').select('id,invoice_code,amount,method,status,transaction_reference,created_at').eq('store_id', storeId).order('created_at', {ascending:false});
  if (error) throw error;
  return data || [];
}

export async function recordPayment(storeId, amount, method, transactionReference = null) {
  const numericAmount = Number(amount);
  if (!storeId || !Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('مبلغ الدفع غير صالح');
  const { data, error } = await supabase.rpc('record_merchant_payment', {
    p_store_id: storeId,
    p_amount: numericAmount,
    p_method: method || 'manual',
    p_transaction_reference: transactionReference,
  });
  if (error) throw error;
  return data;
}
