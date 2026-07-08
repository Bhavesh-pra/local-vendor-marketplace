const express = require('express');
const router = express.Router();
const { authenticateHeader } = require('../middleware/authenticate');

const createProductRoutes = (productController) => {
  router.post('/products/', authenticateHeader, productController.addProduct);
  router.get('/products/', productController.getProducts);
  router.get('/products/:product_id', productController.getProduct);
  return router;
};

module.exports = { createProductRoutes };
