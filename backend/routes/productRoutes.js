const express = require('express');
const router = express.Router();
const { authenticateHeader } = require('../middleware/authenticate');

const createProductRoutes = (productController) => {
  router.post('/products/', authenticateHeader, productController.addProduct);
  router.get('/products/', productController.getProducts);
  router.get('/products/suggestions', productController.getProductSuggestions);
  router.get('/products/:product_id', productController.getProduct);
  router.get('/products/:product_id/recommendations', productController.getRecommendations);
  return router;
};

module.exports = { createProductRoutes };
