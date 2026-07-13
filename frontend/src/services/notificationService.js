/**
 * Phase 5E — Notification Service
 */
import axiosInstance from '../lib/axios.js';

/**
 * Fetch a paginated list of notifications for the logged-in user.
 * @param {object} params
 * @param {number} [params.page]
 * @param {number} [params.limit]
 */
export async function getNotifications({ page = 1, limit = 10 } = {}) {
  const response = await axiosInstance.get('/notifications', {
    params: { page, limit }
  });
  return response.data;
}

/**
 * Mark a single notification as read.
 * @param {number|string} notificationId
 */
export async function markAsRead(notificationId) {
  const response = await axiosInstance.patch(`/notifications/${notificationId}/read`);
  return response.data;
}

/**
 * Mark all user notifications as read.
 */
export async function markAllAsRead() {
  const response = await axiosInstance.patch('/notifications/read-all');
  return response.data;
}
