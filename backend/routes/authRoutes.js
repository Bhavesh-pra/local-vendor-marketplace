const express = require('express');
const router = express.Router();

const createAuthRoutes = (authController) => {
  router.post('/register/', authController.register);
  router.post('/login/', authController.login);
  return router;
};

module.exports = { createAuthRoutes };
