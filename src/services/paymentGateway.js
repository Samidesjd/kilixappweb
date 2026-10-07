// Adapter deliberately does not fake a successful external payment.
// The actual settlement is recorded by billingService after the user completes
// the chosen external/manual payment method.
export async function processPayment({ amount, currency = 'دج', method = 'manual', storeId } = {}) {
  const numericAmount = Number(amount);
  if (!storeId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { success: false, errorMessage: 'بيانات الدفع غير مكتملة' };
  }
  return {
    success: false,
    pending: true,
    amount: numericAmount,
    currency,
    method,
    errorMessage: 'لم يتم تهيئة بوابة دفع إلكترونية فعلية. استخدم مسار الدفع المعتمد في حساب المتجر.',
  };
}
