import axiosInstance from '../lib/axios.js';

/** Fetch all orders for the authenticated user */
export async function getMyOrders() {
  const response = await axiosInstance.get('/orders/my-orders');
  return response.data;
}

/**
 * Fetch a single order by ID
 * @param {number|string} orderId
 */
export async function getOrder(orderId) {
  const response = await axiosInstance.get(`/orders/${orderId}`);
  return response.data;
}

/**
 * Place a new order
 * @param {object} payload
 */
export async function placeOrder(payload) {
  const response = await axiosInstance.post('/orders', payload);
  return response.data;
}

/**
 * Direct order cancellation
 * @param {number|string} orderId
 */
export async function cancelOrder(orderId) {
  const response = await axiosInstance.post(`/orders/${orderId}/cancel`);
  return response.data;
}

/**
 * Fetch all events for an order
 * @param {number|string} orderId
 */
export async function getOrderEvents(orderId) {
  const response = await axiosInstance.get(`/orders/${orderId}/events`);
  return response.data;
}
