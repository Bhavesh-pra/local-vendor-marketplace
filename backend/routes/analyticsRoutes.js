const express = require('express');
const router = express.Router();
const { optionalAuthenticateHeader } = require('../middleware/optionalAuthenticate');

const createAnalyticsRoutes = (analyticsController) => {
  router.post('/analytics/event', optionalAuthenticateHeader, analyticsController.logEvent);
  return router;
};

module.exports = { createAnalyticsRoutes };
