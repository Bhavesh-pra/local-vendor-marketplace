const express = require('express');
const { authenticateHeader } = require('../middleware/authenticate');
const { requireAdmin }       = require('../middleware/requireAdmin');

const adminGuard = [authenticateHeader, requireAdmin];

const createCouponRoutes = (couponController) => {
  const router = express.Router();

  // ─── Customer coupon validation ─────────────────────────────────────────
  router.post('/coupons/validate', authenticateHeader, couponController.validateCoupon);

  // ─── Admin coupon management ────────────────────────────────────────────
  router.get('/admin/coupons',       ...adminGuard, couponController.getAllCoupons);
  router.post('/admin/coupons',      ...adminGuard, couponController.createCoupon);
  router.patch('/admin/coupons/:id', ...adminGuard, couponController.updateCoupon);

  return router;
};

module.exports = { createCouponRoutes };
