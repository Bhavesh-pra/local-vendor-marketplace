import axiosInstance from '../lib/axios.js';

/**
 * Initiate payment for an order
 */
export async function initiatePayment(orderId, paymentMethod, idempotencyKey) {
  const headers = idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {};
  const response = await axiosInstance.post('/api/payments/initiate', {
    order_id: orderId,
    payment_method: paymentMethod
  }, { headers });
  return response.data;
}

/**
 * Simulate payment outcome on the gateway
 */
export async function simulatePayment(paymentId, outcome, failureReason) {
  const response = await axiosInstance.post('/api/payments/simulate', {
    payment_id: paymentId,
    outcome,
    failure_reason: failureReason
  });
  return response.data;
}

/**
 * Retry or switch payment method
 */
export async function retryPayment(orderId, paymentMethod, idempotencyKey) {
  const headers = idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {};
  const response = await axiosInstance.post('/api/payments/retry', {
    order_id: orderId,
    payment_method: paymentMethod
  }, { headers });
  return response.data;
}

/**
 * Fetch customer payment history
 */
export async function getTransactionHistory() {
  const response = await axiosInstance.get('/api/payments/history');
  return response.data;
}

/**
 * Deposit funds to customer wallet
 */
export async function walletDeposit(amount, idempotencyKey) {
  const headers = idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {};
  const response = await axiosInstance.post('/api/payments/wallet/deposit', { amount }, { headers });
  return response.data;
}

/**
 * Fetch wallet balance
 */
export async function getWalletBalance() {
  const response = await axiosInstance.get('/api/payments/wallet/balance');
  return response.data;
}

/**
 * Fetch wallet transaction ledger history
 */
export async function getWalletHistory() {
  const response = await axiosInstance.get('/api/payments/wallet/history');
  return response.data;
}

/**
 * Request refund for a payment
 */
export async function requestRefund(paymentId, amount, reason, idempotencyKey) {
  const headers = idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {};
  const response = await axiosInstance.post('/api/payments/refund/request', {
    payment_id: paymentId,
    amount,
    reason
  }, { headers });
  return response.data;
}

/**
 * Admin approves or rejects refund
 */
export async function approveRefund(refundId, outcome, rejectionReason, adminNotes) {
  const response = await axiosInstance.post('/api/payments/refund/approve', {
    refund_id: refundId,
    outcome,
    rejection_reason: rejectionReason || null,
    admin_notes: adminNotes || null,
  });
  // response.data includes: { message, status, refund_destination }
  // refund_destination tells UI where money went (wallet, or pending_manual for COD/UPI/CARD)
  return response.data;
}

/**
 * Admin fetches financial dashboard metrics
 */
export async function getFinanceMetrics() {
  const response = await axiosInstance.get('/api/payments/finance/metrics');
  return response.data;
}

/**
 * Admin updates commission and transaction settings
 */
export async function updatePlatformSettings(settings) {
  const response = await axiosInstance.post('/api/payments/settings', settings);
  return response.data;
}

/**
 * Admin triggers supplier payout release
 */
export async function triggerSupplierPayout(payoutId) {
  const response = await axiosInstance.post('/api/payments/payouts/trigger', {
    payout_id: payoutId
  });
  return response.data;
}

/**
 * Fetch payouts list for admin or supplier
 */
export async function getSupplierPayouts(supplierId) {
  const url = supplierId ? `/api/payments/payouts?supplier_id=${supplierId}` : '/api/payments/payouts';
  const response = await axiosInstance.get(url);
  return response.data;
}

/**
 * Admin marks a COD order as cash received.
 * Creates a traceable payment record with a transaction reference.
 * @param {number} orderId - the order whose COD cash has been collected
 * @param {string} [notes] - optional admin notes about the collection
 */
export async function markCodCollected(orderId, notes) {
  const response = await axiosInstance.post('/api/payments/cod/collect', {
    order_id: orderId,
    notes: notes || null,
  });
  return response.data;
}
