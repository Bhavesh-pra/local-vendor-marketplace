const express = require('express');
const { authenticateHeader } = require('../middleware/authenticate');
const { requireAdmin }       = require('../middleware/requireAdmin');

/**
 * All routes under /admin/* require:
 *  1. A valid JWT → authenticateHeader
 *  2. role === 'admin' → requireAdmin
 *
 * The combination is applied as a middleware array so both guards
 * run before every handler.
 */
const adminGuard = [authenticateHeader, requireAdmin];
const productGuard = [authenticateHeader, (req, res, next) => {
  if (req.role !== 'admin' && req.role !== 'supplier') {
    return res.status(403).json({ message: 'Access denied: Admin or Supplier role required' });
  }
  next();
}];

const createAdminRoutes = (adminController) => {
  const router = express.Router();

  // ─── Dashboard ──────────────────────────────────────────────────────────
  router.get('/admin/dashboard', ...productGuard, adminController.getDashboardStats);

  // ─── Analytics ──────────────────────────────────────────────────────────
  router.get('/admin/analytics', ...adminGuard, adminController.getAnalytics);

  // ─── Products ───────────────────────────────────────────────────────────
  router.get('/admin/products',            ...productGuard, adminController.getAllProducts);
  router.put('/admin/products/:id',        ...productGuard, adminController.updateProduct);
  router.patch('/admin/products/:id/status', ...productGuard, adminController.setProductStatus);
  router.post('/admin/upload',             ...productGuard, adminController.uploadFile);
  router.post('/admin/products/:id/duplicate', ...productGuard, adminController.duplicateProduct);

  // ─── Categories & Suppliers (for product forms) ─────────────────────────
  router.get('/admin/categories', ...productGuard, adminController.getCategories);
  router.get('/admin/suppliers',  ...productGuard, adminController.getSuppliers);

  // ─── Inventory Analytics, Auditing & Alerts ─────────────────────────────
  router.get('/admin/inventory',         ...adminGuard, adminController.getInventory);
  router.post('/admin/inventory/adjust', ...adminGuard, adminController.adjustInventory);
  router.get('/admin/inventory/value',   ...adminGuard, adminController.getInventoryValue);
  router.get('/admin/inventory/history/:variant_id', ...adminGuard, adminController.getInventoryHistoryByVariant);
  router.get('/admin/alerts',            ...adminGuard, adminController.getAlerts);
  router.patch('/admin/alerts/:id/resolve', ...adminGuard, adminController.resolveAlert);

  // ─── Phase 6D, 6E, 6F Endpoints ──────────────────────────────────────────
  router.get('/admin/supplier-performance', ...adminGuard, adminController.getSupplierPerformance);
  router.get('/admin/inventory-forecast',   ...adminGuard, adminController.getInventoryForecast);
  router.get('/admin/operations-metrics',   ...adminGuard, adminController.getOperationsMetrics);

  // ─── Phase 7 Endpoints ──────────────────────────────────────────────────
  router.get('/admin/analytics/sales', ...adminGuard, adminController.getSalesAnalytics);
  router.get('/admin/analytics/orders', ...adminGuard, adminController.getOrderAnalytics);
  router.get('/admin/analytics/customers', ...adminGuard, adminController.getCustomerAnalytics);
  router.get('/admin/analytics/products', ...adminGuard, adminController.getProductAnalytics);
  router.get('/admin/analytics/funnel', ...adminGuard, adminController.getFunnelAnalytics);
  router.get('/admin/analytics/operational', ...adminGuard, adminController.getOperationalMetrics);
  router.get('/admin/analytics/dashboard-summary', ...adminGuard, adminController.getDashboardSummary);
  router.get('/admin/supplier/analytics', ...productGuard, adminController.getSupplierAnalytics);

  // ─── Orders ─────────────────────────────────────────────────────────────
  router.get('/admin/orders',              ...adminGuard, adminController.getAllOrders);
  router.get('/admin/orders/:id',          ...adminGuard, adminController.getOrderById);
  router.patch('/admin/orders/:id/status', ...adminGuard, adminController.updateOrderStatus);

  // ─── Requests ───────────────────────────────────────────────────────────
  router.get('/admin/requests',     ...adminGuard, adminController.getAllRequests);
  router.patch('/admin/requests/:id', ...adminGuard, adminController.handleRequest);

  // ─── Customers ──────────────────────────────────────────────────────────
  router.get('/admin/customers',             ...adminGuard, adminController.getAllCustomers);
  router.get('/admin/customers/:id',         ...adminGuard, adminController.getCustomerById);
  router.patch('/admin/customers/:id/status', ...adminGuard, adminController.setCustomerStatus);

  // ─── Reviews ────────────────────────────────────────────────────────────
  router.get('/admin/reviews',     ...adminGuard, adminController.getAllReviews);
  router.delete('/admin/reviews/:id', ...adminGuard, adminController.deleteReview);
  router.patch('/admin/reviews/:id/status', ...adminGuard, adminController.updateReviewStatus);

  return router;
};

module.exports = { createAdminRoutes };
