/**
 * Phase 5F — Pricing Service
 * Centralized, backend-driven order summary calculator.
 */
const { calculateShippingFee } = require('./couponService');

/**
 * Calculates the complete order pricing summary for an active cart.
 *
 * @param {object} database sqlite database connection
 * @param {number} userId authenticated user's ID
 * @param {string|null} couponCode optional coupon code to apply and validate
 * @returns {Promise<object>} pricing summary object
 */
const calculateOrderSummary = async (database, userId, couponCode = null) => {
  // 1. Get active cart for user
  const cart = await database.get(
    "SELECT cart_id FROM cart WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  if (!cart) {
    return {
      subtotal: 0,
      original_price: 0,
      discount_amount: 0,
      coupon_savings: 0,
      shipping_fee: 0,
      tax_amount: 0,
      final_total: 0,
      coupon_valid: false,
      coupon_message: 'No active cart found.'
    };
  }

  const cartId = cart.cart_id;

  // 2. Fetch cart items
  const cartItems = await database.all(
    `SELECT ci.variant_id, ci.quantity, ci.unit_price,
            pv.product_id, pv.size, pv.color,
            COALESCE(pv.mrp_override, p.mrp, ci.unit_price) AS mrp,
            IFNULL(ps.free_shipping, 0) AS free_shipping
     FROM cart_items ci
     JOIN product_variants pv ON ci.variant_id = pv.variant_id
     JOIN products p ON pv.product_id = p.product_id
     LEFT JOIN product_shipping ps ON p.product_id = ps.product_id
     WHERE ci.cart_id = ?`,
    [cartId]
  );

  if (cartItems.length === 0) {
    return {
      subtotal: 0,
      original_price: 0,
      discount_amount: 0,
      coupon_savings: 0,
      shipping_fee: 0,
      tax_amount: 0,
      final_total: 0,
      coupon_valid: false,
      coupon_message: 'Cart is empty.'
    };
  }

  const originalPrice = cartItems.reduce((sum, item) => sum + item.mrp * item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const markdownDiscount = Math.max(originalPrice - subtotal, 0);
  const standardShipping = calculateShippingFee(subtotal, cartItems);

  let discount = 0;
  let finalShipping = standardShipping;
  let total = subtotal + standardShipping;
  let couponValid = false;
  let couponMessage = '';
  let couponId = null;

  if (couponCode) {
    const { validateCouponAndCalculateDiscount } = require('./couponService');
    const couponResult = await validateCouponAndCalculateDiscount(database, userId, cartId, couponCode);
    if (couponResult.valid) {
      discount = couponResult.discount_amount;
      finalShipping = couponResult.shipping_fee;
      total = couponResult.final_total;
      couponValid = true;
      couponMessage = couponResult.message;
      couponId = couponResult.coupon_id;
    } else {
      couponMessage = couponResult.message;
    }
  }

  return {
    original_price: originalPrice,
    subtotal,
    discount_amount: markdownDiscount,
    coupon_savings: discount,
    shipping_fee: finalShipping,
    tax_amount: 0,
    final_total: total,
    coupon_valid: couponValid,
    coupon_message: couponMessage,
    coupon_id: couponId
  };
};

module.exports = { calculateOrderSummary };
