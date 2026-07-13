const express = require('express');
const { authenticateHeader, optionalAuthenticateHeader } = require('../middleware/authenticate');

const createReviewRoutes = (reviewController) => {
  const router = express.Router();

  router.get('/reviews/:product_id', optionalAuthenticateHeader, reviewController.getReviews);
  router.get('/reviews/:product_id/eligibility', authenticateHeader, reviewController.checkEligibility);
  router.post('/reviews', authenticateHeader, reviewController.addReview);
  router.put('/reviews/:review_id', authenticateHeader, reviewController.updateReview);
  router.delete('/reviews/:review_id', authenticateHeader, reviewController.deleteReview);
  router.post('/reviews/:review_id/helpful', authenticateHeader, reviewController.voteHelpful);
  router.post('/reviews/upload', authenticateHeader, reviewController.uploadReviewMedia);

  return router;
};

module.exports = { createReviewRoutes };
