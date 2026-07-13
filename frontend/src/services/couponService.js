import axiosInstance from '../lib/axios.js';

/**
 * Validate a coupon code against the current cart.
 * Returns { valid, coupon_id, coupon_code, coupon_type, discount_amount, shipping_fee, final_total, message }
 */
export async function validateCoupon(coupon_code, cart_id) {
  const response = await axiosInstance.post('/coupons/validate', { coupon_code, cart_id });
  return response.data;
}

export async function getAllCoupons() {
  const response = await axiosInstance.get('/admin/coupons');
  return response.data;
}

export async function createCoupon(payload) {
  const response = await axiosInstance.post('/admin/coupons', payload);
  return response.data;
}

export async function updateCoupon(id, payload) {
  const response = await axiosInstance.patch(`/admin/coupons/${id}`, payload);
  return response.data;
}
