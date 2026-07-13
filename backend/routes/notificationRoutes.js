/**
 * Phase 5E — Notification Routes
 */

const express = require('express');
const router = express.Router();
const { authenticateHeader } = require('../middleware/authenticate');

const createNotificationRoutes = (notificationController) => {
  router.get('/notifications', authenticateHeader, notificationController.getNotifications);
  router.patch('/notifications/:id/read', authenticateHeader, notificationController.markAsRead);
  router.patch('/notifications/read-all', authenticateHeader, notificationController.markAllAsRead);
  return router;
};

module.exports = { createNotificationRoutes };
