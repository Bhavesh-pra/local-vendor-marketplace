import axiosInstance from '../lib/axios.js';

/**
 * Fetch reviews for a product
 * @param {number|string} productId
 * @param {object} params
 */
export async function getReviews(productId, params = {}) {
  const response = await axiosInstance.get(`/reviews/${productId}`, { params });
  return response.data;
}

/**
 * Fetch review eligibility status for a product
 * @param {number|string} productId
 */
export async function getReviewEligibility(productId) {
  const response = await axiosInstance.get(`/reviews/${productId}/eligibility`);
  return response.data;
}

/**
 * Submit a review for a product (customer only)
 * @param {object} payload
 */
export async function addReview(payload) {
  const response = await axiosInstance.post('/reviews', payload);
  return response.data;
}

/**
 * Update an existing review (customer only)
 * @param {number|string} reviewId
 * @param {object} payload
 */
export async function updateReview(reviewId, payload) {
  const response = await axiosInstance.put(`/reviews/${reviewId}`, payload);
  return response.data;
}

/**
 * Delete a review (customer only)
 * @param {number|string} reviewId
 */
export async function deleteReview(reviewId) {
  const response = await axiosInstance.delete(`/reviews/${reviewId}`);
  return response.data;
}

/**
 * Toggle helpful vote for a review
 * @param {number|string} reviewId
 */
export async function voteHelpful(reviewId) {
  const response = await axiosInstance.post(`/reviews/${reviewId}/helpful`);
  return response.data;
}

/**
 * Upload a review attachment
 * @param {string} fileName
 * @param {string} fileData base64 encoded
 */
export async function uploadReviewMedia(fileName, fileData) {
  const response = await axiosInstance.post('/reviews/upload', { fileName, fileData });
  return response.data;
}
