const express = require('express');
const router = express.Router();
const { authenticateHeader } = require('../middleware/authenticate');

const createOrderRoutes = (orderController) => {
  router.get('/orders/my-orders', authenticateHeader, orderController.getMyOrders);
  router.get('/orders/:id', authenticateHeader, orderController.getOrder);
  router.get('/orders/:id/events', authenticateHeader, orderController.getOrderEvents);
  router.post('/orders', authenticateHeader, orderController.placeOrder);
  router.post('/orders/:id/cancel', authenticateHeader, orderController.cancelOrder);
  router.post('/orders/:id/requests', authenticateHeader, orderController.createOrderRequest);
  return router;
};

module.exports = { createOrderRoutes };
