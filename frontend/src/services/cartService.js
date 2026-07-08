import axiosInstance from '../lib/axios.js';

/** Create a new cart for the authenticated user */
export async function createCart() {
  const response = await axiosInstance.post('/carts/');
  return response.data;
}

/** Fetch all carts for the authenticated user */
export async function getCarts() {
  const response = await axiosInstance.get('/carts/');
  return response.data;
}

/**
 * Add an item to a cart
 * @param {{ cart_id: number, product_id: number, quantity: number }} payload
 */
export async function addCartItem(payload) {
  const response = await axiosInstance.post('/cart-items/', payload);
  return response.data;
}

/** Fetch cart items for the authenticated user (all carts) */
export async function getCartItems() {
  const response = await axiosInstance.get('/cart-items');
  return response.data;
}

/**
 * Fetch cart items for a specific cart
 * @param {number|string} cartId
 */
export async function getCartItemsById(cartId) {
  const response = await axiosInstance.get(`/cart-items/${cartId}`);
  return response.data;
}

/**
 * Update the quantity of a cart item
 * @param {number|string} cartItemId
 * @param {number} quantity
 */
export async function updateCartItem(cartItemId, quantity) {
  const response = await axiosInstance.put(`/cart-items/${cartItemId}`, { quantity });
  return response.data;
}

/**
 * Remove an item from the cart
 * @param {number|string} cartItemId
 */
export async function deleteCartItem(cartItemId) {
  const response = await axiosInstance.delete(`/cart-items/${cartItemId}`);
  return response.data;
}

/** Fetch all saved for later items */
export async function getSavedItems() {
  const response = await axiosInstance.get('/cart-items/saved');
  return response.data;
}

/** Save an item for later */
export async function saveItem(payload) {
  const response = await axiosInstance.post('/cart-items/saved', payload);
  return response.data;
}

/** Delete a saved item by its ID */
export async function deleteSavedItem(id) {
  const response = await axiosInstance.delete(`/cart-items/saved/${id}`);
  return response.data;
}

/** Move a saved item back to the active cart */
export async function moveSavedItemToCart(id) {
  const response = await axiosInstance.post(`/cart-items/saved/${id}/move`);
  return response.data;
}
