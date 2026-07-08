import axiosInstance from '../lib/axios.js';

/** Fetch all products */
export async function getProducts() {
  const response = await axiosInstance.get('/products/');
  return response.data;
}

/**
 * Fetch a single product by ID
 * @param {number|string} productId
 */
export async function getProduct(productId) {
  const response = await axiosInstance.get(`/products/${productId}`);
  return response.data;
}

/**
 * Create a new product (supplier/admin only)
 * @param {object} payload
 */
export async function addProduct(payload) {
  const response = await axiosInstance.post('/products/', payload);
  return response.data;
}
