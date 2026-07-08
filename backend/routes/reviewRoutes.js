const express = require('express');
const router = express.Router();
const { authenticateHeader } = require('../middleware/authenticate');

const createReviewRoutes = (reviewController) => {
  router.get('/reviews/:product_id', reviewController.getReviews);
  router.post('/reviews/', authenticateHeader, reviewController.addReview);
  return router;
};

module.exports = { createReviewRoutes };
