import axiosInstance from '../lib/axios.js';

/**
 * Fetch reviews for a product
 * @param {number|string} productId
 */
export async function getReviews(productId, params = {}) {
  const response = await axiosInstance.get(`/reviews/${productId}`, { params });
  return response.data;
}

/**
 * Submit a review for a product (customer only)
 * @param {{ product_id: number, rating: number, comment: string }} payload
 */
export async function addReview(payload) {
  const response = await axiosInstance.post('/reviews/', payload);
  return response.data;
}
