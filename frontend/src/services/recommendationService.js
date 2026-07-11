import axiosInstance from '../lib/axios.js';

/**
 * Fetch recommendation candidate lists from backend for a specific product ID
 * @param {number|string} productId
 */
export async function getRecommendations(productId) {
  const response = await axiosInstance.get(`/products/${productId}/recommendations`);
  return response.data;
}
