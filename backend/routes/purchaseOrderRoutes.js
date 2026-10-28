const express = require('express');
const { authenticateHeader } = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/requireAdmin');

const requireSupplier = (req, res, next) => {
  if (req.role !== 'supplier') {
    return res.status(403).json({ message: 'Supplier access required' });
  }
  next();
};

const createPurchaseOrderRoutes = (poController) => {
  const router = express.Router();

  // Admin routes
  router.get('/admin/purchase-orders', authenticateHeader, requireAdmin, poController.getAdminPurchaseOrders);
  router.post('/admin/purchase-orders', authenticateHeader, requireAdmin, poController.createPurchaseOrder);
  router.get('/admin/purchase-orders/:id', authenticateHeader, requireAdmin, poController.getPurchaseOrderDetails);
  router.patch('/admin/purchase-orders/:id/status', authenticateHeader, requireAdmin, poController.updatePurchaseOrderStatus);
  router.post('/admin/purchase-orders/:id/receive', authenticateHeader, requireAdmin, poController.receivePurchaseOrderInventory);

  // Supplier routes
  router.get('/supplier/purchase-orders', authenticateHeader, requireSupplier, poController.getSupplierPurchaseOrders);
  router.get('/supplier/purchase-orders/:id', authenticateHeader, requireSupplier, poController.getSupplierPurchaseOrderDetails);
  router.patch('/supplier/purchase-orders/:id/acknowledge', authenticateHeader, requireSupplier, poController.acknowledgePurchaseOrder);

  return router;
};

module.exports = { createPurchaseOrderRoutes };
