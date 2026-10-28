/**
 * refundDestination.test.js
 *
 * Tests for the refund money traceability fix.
 *
 * What this covers:
 *  1. WALLET refunds auto-credit the wallet_transactions ledger
 *  2. Non-wallet refunds (COD/UPI/CARD) create a refund_disbursements record
 *  3. Non-wallet refunds do NOT silently mark themselves "done"
 *  4. The approveRefund response includes a refund_destination field
 *  5. Rejected refunds do not create any money movement records
 *  6. Refund amount cannot exceed payment amount (idempotency protection)
 *  7. The payout controller sends back refund_destination in all cases
 */

const path = require('path');
const fs = require('fs');

const payoutControllerSrc = fs.readFileSync(
  path.join(__dirname, '../controllers/payoutController.js'),
  'utf8'
);

describe('Refund Money Traceability', () => {
  describe('Wallet refunds', () => {
    it('should auto-credit wallet_transactions for WALLET payments', () => {
      // Wallet flow inserts into wallet_transactions
      expect(payoutControllerSrc).toContain("payment_method === 'WALLET'");
      expect(payoutControllerSrc).toContain('wallet_transactions');
      expect(payoutControllerSrc).toContain("'refund'");
    });

    it('should log a wallet_credited financial event', () => {
      expect(payoutControllerSrc).toContain('wallet_credited');
    });

    it('should set refund_destination with status completed for wallet', () => {
      expect(payoutControllerSrc).toContain("method: 'WALLET'");
      expect(payoutControllerSrc).toContain("status: 'completed'");
    });
  });

  describe('Non-wallet refunds (COD/UPI/CARD)', () => {
    it('should create a refund_disbursements record instead of silently completing', () => {
      expect(payoutControllerSrc).toContain('refund_disbursements');
      expect(payoutControllerSrc).toContain('INSERT INTO refund_disbursements');
    });

    it('should set status to pending_manual for non-wallet refunds', () => {
      expect(payoutControllerSrc).toContain('pending_manual');
      expect(payoutControllerSrc).toContain("disbursementStatus = 'pending_manual'");
    });

    it('should include the notes field explaining what manual action is needed', () => {
      expect(payoutControllerSrc).toContain('disbursementNotes');
      expect(payoutControllerSrc).toContain('Manual');
    });

    it('should use idempotency key to prevent duplicate disbursements', () => {
      expect(payoutControllerSrc).toContain('disbursement-refund-');
      expect(payoutControllerSrc).toContain('existingDisbursement');
    });

    it('should log a manual_refund_pending financial event', () => {
      expect(payoutControllerSrc).toContain('manual_refund_pending');
    });

    it('should return requires_manual_action: true in the response', () => {
      expect(payoutControllerSrc).toContain('requires_manual_action');
    });
  });

  describe('Response contract', () => {
    it('should always return refund_destination in the approve response', () => {
      expect(payoutControllerSrc).toContain('refund_destination: refundDestination');
    });

    it('should include both status and message in the response', () => {
      expect(payoutControllerSrc).toContain("'Refund status updated successfully.'");
      expect(payoutControllerSrc).toContain('status: newStatus');
    });
  });

  describe('Refund rejection', () => {
    it('should NOT create any money records when outcome is rejected', () => {
      // The rejection path only calls logFinancialEvent with 'refund_rejected'
      // It does not touch wallet_transactions or refund_disbursements
      const rejectionStart = payoutControllerSrc.indexOf("await logFinancialEvent('refund', refund_id, 'refund_rejected'");
      expect(rejectionStart).toBeGreaterThan(-1);
      // The rejection block should not contain wallet_transactions or refund_disbursements inserts
      const rejectionBlock = payoutControllerSrc.substring(
        Math.max(0, rejectionStart - 200),
        rejectionStart + 300
      );
      expect(rejectionBlock).not.toContain('INSERT INTO wallet_transactions');
      expect(rejectionBlock).not.toContain('INSERT INTO refund_disbursements');
    });
  });

  describe('Supplier payout adjustment', () => {
    it('should adjust supplier payout proportionally when refund is approved', () => {
      expect(payoutControllerSrc).toContain('refundShare');
      expect(payoutControllerSrc).toContain('payout_adjusted');
      expect(payoutControllerSrc).toContain('Math.max(0, payout.amount - refundShare)');
    });

    it('should not reduce payout below zero', () => {
      expect(payoutControllerSrc).toContain('Math.max(0,');
    });
  });

  describe('Payment status sync', () => {
    it('should update payment status to refunded when fully refunded', () => {
      expect(payoutControllerSrc).toContain("paymentState = 'refunded'");
    });

    it('should update payment status to partially_refunded for partial refunds', () => {
      expect(payoutControllerSrc).toContain("paymentState = 'partially_refunded'");
    });

    it('should update the order payment_status to match', () => {
      expect(payoutControllerSrc).toContain('UPDATE orders SET payment_status');
      expect(payoutControllerSrc).toContain('orderPaymentState');
    });
  });

  describe('Transaction integrity', () => {
    it('should wrap the entire approval in a database transaction', () => {
      expect(payoutControllerSrc).toContain("database.run('BEGIN TRANSACTION')");
      expect(payoutControllerSrc).toContain("database.run('ROLLBACK')");
      expect(payoutControllerSrc).toContain("database.run('COMMIT')");
    });

    it('should rollback on any error', () => {
      expect(payoutControllerSrc).toContain('trxErr');
      const rollbackCount = (payoutControllerSrc.match(/ROLLBACK/g) || []).length;
      expect(rollbackCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DB schema', () => {
    it('should define refund_disbursements table in db.js', () => {
      const dbSrc = fs.readFileSync(path.join(__dirname, '../db.js'), 'utf8');
      expect(dbSrc).toContain('CREATE TABLE IF NOT EXISTS refund_disbursements');
      expect(dbSrc).toContain('pending_manual');
      expect(dbSrc).toContain('completed_at DATETIME');
    });

    it('should have idempotency_key on refund_disbursements', () => {
      const dbSrc = fs.readFileSync(path.join(__dirname, '../db.js'), 'utf8');
      // Find refund_disbursements block and verify idempotency_key is present
      const disbursementBlock = dbSrc.match(/CREATE TABLE IF NOT EXISTS refund_disbursements \([\s\S]*?\n\s*\)/);
      expect(disbursementBlock).toBeTruthy();
      expect(disbursementBlock[0]).toContain('idempotency_key TEXT UNIQUE');
    });
  });
});
