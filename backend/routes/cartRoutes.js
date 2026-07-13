const express = require('express');
const router = express.Router();
const { authenticateHeader } = require('../middleware/authenticate');

const createCartRoutes = (cartController) => {
  router.post('/carts/', authenticateHeader, cartController.createCart);
  router.get('/carts/', authenticateHeader, cartController.getCarts);
  router.get('/cart/summary', authenticateHeader, cartController.getCartSummary);
  router.post('/cart-items/', authenticateHeader, cartController.addCartItem);
  router.get('/cart-items', authenticateHeader, cartController.getCartItems);
  
  // Save For Later routes (registered before parametric routes to avoid collisions)
  router.get('/cart-items/saved', authenticateHeader, cartController.getSavedItems);
  router.post('/cart-items/saved', authenticateHeader, cartController.saveItem);
  router.delete('/cart-items/saved/:id', authenticateHeader, cartController.deleteSavedItem);
  router.post('/cart-items/saved/:id/move', authenticateHeader, cartController.moveToCart);

  router.get('/cart-items/:cart_id', authenticateHeader, cartController.getCartItemsById);
  router.put('/cart-items/:cart_item_id', authenticateHeader, cartController.updateCartItem);
  router.delete('/cart-items/:cart_item_id', authenticateHeader, cartController.deleteCartItem);
  return router;
};

module.exports = { createCartRoutes };
