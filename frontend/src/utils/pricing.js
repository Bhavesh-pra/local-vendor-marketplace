import { SHIPPING_THRESHOLD, SHIPPING_FEE, TAX_RATE } from '../constants/pricing.js';

/**
 * Calculate shipping cost based on subtotal and product-level free delivery rules.
 * @param {number} subtotal
 * @param {object[]} items
 * @returns {number}
 */
export function calculateShipping(subtotal, items = []) {
  const hasFreeDeliveryProduct = items.some(item => item.free_shipping === 1);
  if (hasFreeDeliveryProduct) {
    return 0;
  }
  if (subtotal >= 1000) {
    return 0;
  }
  if (subtotal >= 800) {
    return 20;
  }
  if (subtotal >= 500) {
    return 50;
  }
  return 80;
}

/**
 * Calculate tax amount. Always returns 0 per transparent pricing policy.
 * @param {number} subtotal
 * @returns {number}
 */
export function calculateTax(subtotal) {
  return 0;
}

/**
 * Calculate order grand total.
 * @param {number} subtotal
 * @param {number} shipping
 * @param {number} tax
 * @returns {number}
 */
export function calculateTotal(subtotal, shipping, tax = 0) {
  return subtotal + shipping;
}
