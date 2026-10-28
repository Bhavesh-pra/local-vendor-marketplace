const express = require('express');
const router = express.Router();
const { optionalAuthenticateHeader } = require('../middleware/authenticate');
const { validateSchema } = require('../middleware/validate');
const { loginLimiter, registerLimiter, refreshLimiter } = require('../middleware/security');

const registerSchema = {
  body: {
    email: { type: 'email', required: true },
    password: { type: 'string', minLength: 6, required: true },
    username: { type: 'string', minLength: 3, required: true }
  }
};

const loginSchema = {
  body: {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true }
  }
};

const createAuthRoutes = (authController) => {
  router.post('/register/', registerLimiter, validateSchema(registerSchema), authController.register);
  router.post('/login/', loginLimiter, validateSchema(loginSchema), authController.login);
  router.post('/refresh/', refreshLimiter, authController.refresh);
  router.post('/logout/', optionalAuthenticateHeader, authController.logout);
  return router;
};

module.exports = { createAuthRoutes };
