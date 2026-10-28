const express = require('express');
const { authenticateHeader } = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/requireAdmin');

const productGuard = [authenticateHeader, (req, res, next) => {
  if (req.role === 'admin' || req.role === 'supplier') {
    next();
  } else {
    return res.status(403).json({ message: 'Forbidden. Admin or supplier role required.' });
  }
}];

const adminGuard = [authenticateHeader, requireAdmin];
const authGuard = [authenticateHeader];

const createPaymentRoutes = (database, paymentCtrl, payoutCtrl) => {
  const router = express.Router();

  // ─── Customer Payments ───
  router.post('/initiate', ...authGuard, paymentCtrl.initiatePayment);
  // SECURITY: simulate is admin-only — customers must not be able to force payment outcomes
  router.post('/simulate', ...adminGuard, paymentCtrl.simulatePayment);
  router.post('/retry', ...authGuard, paymentCtrl.retryPayment);
  router.get('/history', ...authGuard, paymentCtrl.getTransactionHistory);

  // ─── COD Cash Collection (Admin only) ───
  router.post('/cod/collect', ...adminGuard, paymentCtrl.markCodCollected);

  // ─── Customer Wallet Ledger ───
  router.post('/wallet/deposit', ...authGuard, paymentCtrl.walletDeposit);
  router.get('/wallet/balance', ...authGuard, paymentCtrl.getWalletBalance);
  router.get('/wallet/history', ...authGuard, paymentCtrl.getWalletHistory);

  // ─── Customer / Admin Refunds ───
  router.post('/refund/request', ...authGuard, paymentCtrl.requestRefund);
  router.post('/refund/approve', ...adminGuard, payoutCtrl.approveRefund);

  // ─── Admin Financial Dashboards & Settings ───
  router.get('/finance/metrics', ...adminGuard, payoutCtrl.getFinanceMetrics);
  router.post('/settings', ...adminGuard, payoutCtrl.updatePlatformSettings);
  router.post('/payouts/trigger', ...adminGuard, payoutCtrl.triggerSupplierPayout);

  // ─── Admin / Supplier Payout Lists ───
  router.get('/payouts', ...productGuard, payoutCtrl.getSupplierPayouts);

  return router;
};

module.exports = { createPaymentRoutes };
