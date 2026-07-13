/**
 * Phase 5D - Coupon Validation Service
 *
 * Validates a coupon code against business rules and calculates the
 * discount amount for the given user's cart.
 */

const calculateShippingFee = (subtotal, cartItems) => {
  const hasFreeDeliveryProduct = cartItems.some((item) => item.free_shipping === 1);

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
};

const validateCouponAndCalculateDiscount = async (database, userId, cartId, couponCode) => {
  const normalizedCode = couponCode?.trim();
  if (!normalizedCode) {
    return { valid: false, message: 'Coupon code is required.' };
  }

  const cart = await database.get(
    `SELECT cart_id, user_id, status
     FROM cart
     WHERE cart_id = ?`,
    [cartId]
  );

  if (!cart || cart.user_id !== userId) {
    return { valid: false, message: 'Cart not found for this user.' };
  }

  if (cart.status !== 'active') {
    return { valid: false, message: 'Only active carts can accept coupons.' };
  }

  const coupon = await database.get(
    `SELECT * FROM coupons WHERE LOWER(coupon_code) = LOWER(?)`,
    [normalizedCode]
  );
  if (!coupon) {
    return { valid: false, message: 'Coupon code not found.' };
  }

  if (coupon.status !== 'active') {
    return { valid: false, message: 'This coupon is no longer active.' };
  }

  if (coupon.expiration_date) {
    const now = new Date();
    const expiry = new Date(`${coupon.expiration_date}T23:59:59.999`);
    if (now > expiry) {
      return { valid: false, message: 'This coupon has expired.' };
    }
  }

  if (coupon.usage_limit !== null && coupon.usage_limit !== undefined) {
    const { total_redemptions } = await database.get(
      `SELECT COUNT(*) AS total_redemptions FROM coupon_redemptions WHERE coupon_id = ?`,
      [coupon.coupon_id]
    );
    if (total_redemptions >= coupon.usage_limit) {
      return { valid: false, message: 'This coupon has reached its usage limit.' };
    }
  }

  if (coupon.per_user_limit !== null && coupon.per_user_limit !== undefined) {
    const { user_redemptions } = await database.get(
      `SELECT COUNT(*) AS user_redemptions FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?`,
      [coupon.coupon_id, userId]
    );
    if (user_redemptions >= coupon.per_user_limit) {
      return { valid: false, message: 'You have already used this coupon the maximum number of times.' };
    }
  }

  const cartItems = await database.all(
    `SELECT ci.variant_id, ci.quantity, ci.unit_price,
            p.product_id, p.category_id, p.product_name,
            IFNULL(ps.free_shipping, 0) AS free_shipping
     FROM cart_items ci
     JOIN product_variants pv ON ci.variant_id = pv.variant_id
     JOIN products p ON pv.product_id = p.product_id
     LEFT JOIN product_shipping ps ON p.product_id = ps.product_id
     WHERE ci.cart_id = ?`,
    [cartId]
  );

  if (cartItems.length === 0) {
    return { valid: false, message: 'Cart is empty.' };
  }

  let subtotal = 0;
  for (const item of cartItems) {
    subtotal += item.unit_price * item.quantity;
  }

  if (coupon.min_order_value && subtotal < coupon.min_order_value) {
    return {
      valid: false,
      message: `Minimum order value of Rs.${coupon.min_order_value} is required for this coupon.`,
    };
  }

  const couponCategories = await database.all(
    `SELECT category_id FROM coupon_categories WHERE coupon_id = ?`,
    [coupon.coupon_id]
  );
  const couponProducts = await database.all(
    `SELECT product_id FROM coupon_products WHERE coupon_id = ?`,
    [coupon.coupon_id]
  );

  let qualifyingSubtotal = subtotal;

  if (couponCategories.length > 0 || couponProducts.length > 0) {
    const categoryIds = couponCategories.map((row) => row.category_id);
    const productIds = couponProducts.map((row) => row.product_id);

    qualifyingSubtotal = 0;
    for (const item of cartItems) {
      if (categoryIds.includes(item.category_id) || productIds.includes(item.product_id)) {
        qualifyingSubtotal += item.unit_price * item.quantity;
      }
    }

    if (qualifyingSubtotal === 0) {
      return { valid: false, message: 'No items in your cart qualify for this coupon.' };
    }
  }

  const shipping = calculateShippingFee(subtotal, cartItems);

  let discount = 0;
  if (coupon.coupon_type === 'fixed') {
    discount = Math.min(coupon.discount_value, qualifyingSubtotal);
  } else if (coupon.coupon_type === 'percentage') {
    discount = (coupon.discount_value / 100) * qualifyingSubtotal;
    if (coupon.max_discount_amount !== null && coupon.max_discount_amount !== undefined) {
      discount = Math.min(discount, coupon.max_discount_amount);
    }
  } else if (coupon.coupon_type === 'free_shipping') {
    discount = shipping;
  }

  discount = Math.round(discount * 100) / 100;

  let finalTotal = subtotal + shipping - discount;
  if (finalTotal < 0) {
    finalTotal = 0;
  }

  return {
    valid: true,
    coupon_id: coupon.coupon_id,
    coupon_code: coupon.coupon_code,
    coupon_type: coupon.coupon_type,
    discount_amount: discount,
    shipping_fee: shipping,
    final_total: finalTotal,
    coupon,
    message: 'Coupon applied successfully!',
  };
};

module.exports = { validateCouponAndCalculateDiscount, calculateShippingFee };
