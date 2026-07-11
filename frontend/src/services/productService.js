import axiosInstance from '../lib/axios.js';

/** Fetch all products */
export async function getProducts(params = {}, config = {}) {
  const response = await axiosInstance.get('/products/', { params, ...config });
  return response.data;
}

export async function getProductSuggestions(q, config = {}) {
  const response = await axiosInstance.get('/products/suggestions', { params: { q }, ...config });
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
