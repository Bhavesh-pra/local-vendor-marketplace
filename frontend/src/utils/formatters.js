import { PAYMENT_METHODS } from '../constants/payment.js';

/** INR currency formatter */
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a number as INR currency string, e.g. ₹1,299.00
 * This is the ONLY place rounding occurs.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '₹0.00';
  return currencyFormatter.format(amount);
}

/** Date formatter */
const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Format an ISO date string or Date object to a readable date.
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return dateFormatter.format(new Date(dateStr));
  } catch {
    return String(dateStr);
  }
}

/** Order status display map */
const ORDER_STATUS_MAP = {
  pending:          'Pending',
  confirmed:        'Confirmed',
  packed:           'Packed',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
};

/**
 * Map a raw order status string to a human-readable label.
 * Falls back to the raw value if unmapped.
 * @param {string} rawStatus
 * @returns {string}
 */
export function formatOrderStatus(rawStatus) {
  return ORDER_STATUS_MAP[rawStatus] ?? rawStatus ?? '—';
}

/**
 * Map a raw payment method value to a display label.
 * Falls back to the raw value if not found in constants.
 * @param {string} rawMethod
 * @returns {string}
 */
export function formatPaymentMethod(rawMethod) {
  const found = PAYMENT_METHODS.find((m) => m.value === rawMethod);
  return found ? found.label : (rawMethod ?? '—');
}
