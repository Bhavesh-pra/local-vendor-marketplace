const express = require('express');
const { authenticateHeader } = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/requireAdmin');

const createReturnRoutes = (returnController) => {
  const router = express.Router();

  router.post('/orders/:id/items/:variant_id/returns', authenticateHeader, returnController.createReturn);
  router.get('/returns/my-returns', authenticateHeader, returnController.getMyReturns);
  router.get('/returns/:return_id', authenticateHeader, returnController.getReturnDetails);
  
  // Admin endpoints
  router.get('/admin/returns', authenticateHeader, requireAdmin, returnController.getAdminReturns);
  router.patch('/admin/returns/:return_id/status', authenticateHeader, requireAdmin, returnController.updateReturnStatus);

  return router;
};

module.exports = { createReturnRoutes };
