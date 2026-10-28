const createPayoutController = (database) => {
  // Helper to log platform financial event
  const logFinancialEvent = async (entityType, entityId, action, actor, metadata = {}) => {
    try {
      await database.run(
        `INSERT INTO financial_events (entity_type, entity_id, action, actor, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        [entityType, entityId, action, actor, JSON.stringify(metadata)]
      );
    } catch (err) {
      console.error('[Financial Event Log Error]:', err.message);
    }
  };

  // Helper to log Phase 7 telemetry event
  const logTelemetryEvent = async (eventName, userId, productId, categoryId, metadata = {}) => {
    try {
      const sessionId = metadata.session_id || 'mock-session-id';
      await database.run(
        `INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [eventName, userId, sessionId, productId, categoryId, JSON.stringify(metadata)]
      );
    } catch (err) {
      console.error('[Telemetry Event Log Error]:', err.message);
    }
  };

  return {
    // ─── Supplier Payout Dashboard Summaries ───
    getSupplierPayouts: async (req, res) => {
      let supplierId = req.userId;
      if (req.role === 'admin' && req.query.supplier_id) {
        supplierId = parseInt(req.query.supplier_id, 10);
      }

      try {
        const payouts = await database.all(
          `SELECT sp.*, o.order_number, o.total_amount AS order_total
           FROM supplier_payouts sp
           JOIN orders o ON sp.order_id = o.order_id
           WHERE sp.supplier_id = ?
           ORDER BY sp.created_at DESC`,
          [supplierId]
        );

        // Calculate summary stats
        const successfulSum = await database.get(
          "SELECT SUM(amount) AS total FROM supplier_payouts WHERE supplier_id = ? AND status = 'completed'",
          [supplierId]
        );
        const pendingSum = await database.get(
          "SELECT SUM(amount) AS total FROM supplier_payouts WHERE supplier_id = ? AND status IN ('pending', 'scheduled', 'processing')",
          [supplierId]
        );

        // Refund impact (sum of completed refunds related to this supplier's products)
        const refundImpact = await database.get(
          `SELECT SUM(r.amount) AS total
           FROM refunds r
           JOIN payments p ON r.payment_id = p.payment_id
           JOIN order_items oi ON p.order_id = oi.order_id
           WHERE oi.supplier_id = ? AND r.status = 'completed'`,
          [supplierId]
        );

        const successfulPayouts = successfulSum ? (successfulSum.total || 0) : 0;
        const pendingPayouts = pendingSum ? (pendingSum.total || 0) : 0;
        const refundDeductions = refundImpact ? (refundImpact.total || 0) : 0;

        // Fetch supplier product sales totals
        const salesTotal = await database.get(
          `SELECT SUM(line_total) AS total 
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.order_id
           WHERE oi.supplier_id = ? AND o.payment_status = 'paid'`,
          [supplierId]
        );
        const grossSales = salesTotal ? (salesTotal.total || 0) : 0;

        const commissionTotal = await database.get(
          "SELECT SUM(commission_deducted + platform_fee_deducted) AS total FROM supplier_payouts WHERE supplier_id = ?",
          [supplierId]
        );
        const totalCommissions = commissionTotal ? (commissionTotal.total || 0) : 0;

        const netRevenue = grossSales - totalCommissions - refundDeductions;

        return res.status(200).json({
          payouts,
          summary: {
            successfulPayouts,
            pendingPayouts,
            refundImpact: refundDeductions,
            netRevenue
          }
        });
      } catch (err) {
        console.error('[Supplier payouts error]:', err.message);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Admin Financial Dashboard Metrics ───
    getFinanceMetrics: async (req, res) => {
      if (req.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden. Admin access required.' });
      }

      try {
        const tpvRow = await database.get(
          "SELECT SUM(amount) AS total FROM payments WHERE status = 'completed'"
        );
        const attemptsRow = await database.get("SELECT COUNT(*) AS count FROM payments");
        const successRow = await database.get("SELECT COUNT(*) AS count FROM payments WHERE status = 'completed'");
        const failedRow = await database.get("SELECT COUNT(*) AS count FROM payments WHERE status = 'failed'");
        const pendingRow = await database.get("SELECT COUNT(*) AS count FROM payments WHERE status = 'processing'");
        
        const refundsRow = await database.get(
          "SELECT SUM(amount) AS total FROM refunds WHERE status = 'completed'"
        );

        const tpv = tpvRow ? (tpvRow.total || 0) : 0;
        const totalAttempts = attemptsRow ? (attemptsRow.count || 0) : 0;
        const successCount = successRow ? (successRow.count || 0) : 0;
        const failedCount = failedRow ? (failedRow.count || 0) : 0;
        const pendingCount = pendingRow ? (pendingRow.count || 0) : 0;
        const refundsIssued = refundsRow ? (refundsRow.total || 0) : 0;

        const successRate = totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0;
        const refundRate = tpv > 0 ? (refundsIssued / tpv) * 100 : 0;

        // Platform commissions total (commissions + platform flat fees)
        const commissionsRow = await database.get(
          "SELECT SUM(commission_deducted + platform_fee_deducted) AS total FROM supplier_payouts"
        );
        const platformCommissions = commissionsRow ? (commissionsRow.total || 0) : 0;

        // Payment method split distribution
        const distribution = await database.all(
          `SELECT payment_method, COUNT(*) AS count, SUM(amount) AS total 
           FROM payments 
           WHERE status = 'completed'
           GROUP BY payment_method`
        );

        // Fetch refund requests for approval logs
        const refundRequests = await database.all(
          `SELECT r.*, p.transaction_reference, o.order_number, u.username AS customer_name
           FROM refunds r
           JOIN payments p ON r.payment_id = p.payment_id
           JOIN orders o ON p.order_id = o.order_id
           JOIN users u ON o.user_id = u.user_id
           ORDER BY r.created_at DESC`
        );

        // Fetch payouts list
        const payoutsList = await database.all(
          `SELECT sp.*, o.order_number, u.username AS supplier_name
           FROM supplier_payouts sp
           JOIN orders o ON sp.order_id = o.order_id
           JOIN users u ON sp.supplier_id = u.user_id
           ORDER BY sp.created_at DESC`
        );

        // Get config settings
        const settings = await database.all("SELECT * FROM platform_settings");

        return res.status(200).json({
          metrics: {
            tpv,
            successRate,
            failedCount,
            pendingCount,
            refundsIssued,
            refundRate,
            platformCommissions
          },
          distribution,
          refundRequests,
          payouts: payoutsList,
          settings
        });
      } catch (err) {
        console.error('[Admin finance metrics error]:', err.message);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Update Settings ───
    updatePlatformSettings: async (req, res) => {
      if (req.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden.' });
      }

      const { commission_percentage, fixed_transaction_fee, minimum_commission, maximum_commission } = req.body;

      try {
        await database.run('BEGIN TRANSACTION');
        try {
          if (commission_percentage !== undefined) {
            await database.run("UPDATE platform_settings SET value = ?, updated_at = datetime('now') WHERE key = 'commission_percentage'", [commission_percentage]);
          }
          if (fixed_transaction_fee !== undefined) {
            await database.run("UPDATE platform_settings SET value = ?, updated_at = datetime('now') WHERE key = 'fixed_transaction_fee'", [fixed_transaction_fee]);
          }
          if (minimum_commission !== undefined) {
            await database.run("UPDATE platform_settings SET value = ?, updated_at = datetime('now') WHERE key = 'minimum_commission'", [minimum_commission]);
          }
          if (maximum_commission !== undefined) {
            await database.run("UPDATE platform_settings SET value = ?, updated_at = datetime('now') WHERE key = 'maximum_commission'", [maximum_commission]);
          }
          await database.run('COMMIT');
          return res.status(200).json({ message: 'Platform settings updated successfully.' });
        } catch (trxErr) {
          await database.run('ROLLBACK');
          throw trxErr;
        }
      } catch (err) {
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Admin Triggers Supplier Payout Completion ───
    triggerSupplierPayout: async (req, res) => {
      if (req.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden. Admin access required.' });
      }

      const { payout_id } = req.body;
      if (!payout_id) {
        return res.status(400).json({ message: 'Payout ID is required.' });
      }

      try {
        const payout = await database.get("SELECT * FROM supplier_payouts WHERE payout_id = ?", [payout_id]);
        if (!payout) {
          return res.status(404).json({ message: 'Payout record not found.' });
        }

        if (payout.status === 'completed' || payout.status === 'failed') {
          return res.status(400).json({ message: `Payout is already in final state: ${payout.status}` });
        }

        // Validate protected release rules: payout must be 'scheduled' or 'processing' (cannot be 'pending' if delivery hasn't happened yet)
        if (payout.status === 'pending') {
          return res.status(400).json({ message: 'Cannot process payout: Order is not yet delivered.' });
        }

        const prevStatus = payout.status;
        const newStatus = 'completed';
        const timelineLog = JSON.parse(payout.timeline || '{}');
        timelineLog.completed_at = new Date();

        await database.run('BEGIN TRANSACTION');
        try {
          await database.run(
            `UPDATE supplier_payouts 
             SET status = ?, timeline = ?, updated_at = datetime('now')
             WHERE payout_id = ?`,
            [newStatus, JSON.stringify(timelineLog), payout_id]
          );

          await logFinancialEvent('payout', payout_id, 'payout_completed', 'admin', { supplier_id: payout.supplier_id });
          await logTelemetryEvent('payout_completed', payout.supplier_id, null, null, { payout_id, amount: payout.amount });

          await database.run('COMMIT');
          return res.status(200).json({ message: 'Payout processed and completed successfully.', status: newStatus });
        } catch (trxErr) {
          await database.run('ROLLBACK');
          throw trxErr;
        }
      } catch (err) {
        console.error('[Trigger payout error]:', err.message);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Approve/Reject Refund ───
    approveRefund: async (req, res) => {
      if (req.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden. Admin access required.' });
      }

      const { refund_id, outcome, rejection_reason, admin_notes } = req.body;
      if (!refund_id || !outcome) {
        return res.status(400).json({ message: 'Refund ID and outcome (approved/rejected) are required.' });
      }

      try {
        const refund = await database.get('SELECT * FROM refunds WHERE refund_id = ?', [refund_id]);
        if (!refund) {
          return res.status(404).json({ message: 'Refund record not found.' });
        }

        if (refund.status !== 'requested') {
          return res.status(400).json({ message: `Refund is already processed with status: ${refund.status}` });
        }

        const payment = await database.get('SELECT * FROM payments WHERE payment_id = ?', [refund.payment_id]);
        const order = await database.get('SELECT * FROM orders WHERE order_id = ?', [payment.order_id]);

        let newStatus = 'rejected';
        if (outcome === 'approved') {
          newStatus = 'completed';
        }

        let refundDestination = null; // will be set below for approved refunds

        await database.run('BEGIN TRANSACTION');
        try {
          // 1. Update refund status
          await database.run(
            `UPDATE refunds 
             SET status = ?, rejection_reason = ?, admin_notes = ?, updated_at = datetime('now')
             WHERE refund_id = ?`,
            [newStatus, rejection_reason || null, admin_notes || null, refund_id]
          );

          if (outcome === 'approved') {
            await logFinancialEvent('refund', refund_id, 'refund_completed', 'admin', { payment_id: refund.payment_id, amount: refund.amount });
            await logTelemetryEvent('refund_completed', order.user_id, null, null, { refund_id, amount: refund.amount });

            // 2. Sync payment status to refunded / partially_refunded
            const completedRefundsRow = await database.get(
              "SELECT SUM(amount) AS total FROM refunds WHERE payment_id = ? AND status = 'completed'",
              [refund.payment_id]
            );
            const totalRefunded = completedRefundsRow ? (completedRefundsRow.total || 0) : 0;

            let paymentState = 'partially_refunded';
            let orderPaymentState = 'partially_refunded';
            if (totalRefunded >= payment.amount) {
              paymentState = 'refunded';
              orderPaymentState = 'refunded';
            }

            await database.run(
              "UPDATE payments SET status = ?, updated_at = datetime('now') WHERE payment_id = ?",
              [paymentState, refund.payment_id]
            );

            await database.run(
              "UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE order_id = ?",
              [orderPaymentState, payment.order_id]
            );

            // Log order event
            await database.run(
              `INSERT INTO order_events (order_id, status, message)
               VALUES (?, ?, ?)`,
              [payment.order_id, order.status, `Refund executed: ${orderPaymentState}. Amount: ${refund.amount}.`]
            );

            // 3. Refund money routing — WALLET vs non-WALLET
            if (payment.payment_method === 'WALLET') {
              // ── WALLET: auto-credit ledger ──
              const walletRef = `refund:${refund_id}`;
              const walletIdempotency = `wallet-credit-refund-${refund_id}`;
              await database.run(
                `INSERT INTO wallet_transactions (user_id, type, amount, reference_id, idempotency_key)
                 VALUES (?, 'refund', ?, ?, ?)`,
                [order.user_id, refund.amount, walletRef, walletIdempotency]
              );
              const walletTxRow = await database.get('SELECT last_insert_rowid() AS id');
              await logFinancialEvent('wallet_transaction', walletTxRow.id, 'wallet_credited', 'admin', {
                user_id: order.user_id,
                amount: refund.amount,
                is_refund: true
              });
              await logTelemetryEvent('wallet_credit', order.user_id, null, null, { refund_id, amount: refund.amount });
              refundDestination = { method: 'WALLET', status: 'completed', notes: 'Wallet credited automatically.' };
            } else {
              // ── NON-WALLET (COD / UPI / CARD / etc.) ──
              // Decision: we cannot auto-transfer real money without a payment gateway.
              // We create an explicit disbursement record so the admin knows they must
              // manually process this refund (e.g., bank transfer, cash handback).
              // The record tracks: method, amount, status, and admin notes for the paper trail.
              const disbursementIdempotency = `disbursement-refund-${refund_id}`;
              let disbursementMethod = payment.payment_method;

              // For COD the money must be physically returned; for UPI/CARD it is a bank transfer
              const requiresManualAction = true;
              const disbursementStatus = 'pending_manual';
              const disbursementNotes = admin_notes
                ? `Admin notes: ${admin_notes}`
                : `Refund of ₹${refund.amount} for order #${order.order_number}. Manual ${disbursementMethod} refund required.`;

              // Upsert disbursement record (in case of retry)
              const existingDisbursement = await database.get(
                'SELECT id FROM refund_disbursements WHERE idempotency_key = ?',
                [disbursementIdempotency]
              );
              if (!existingDisbursement) {
                await database.run(
                  `INSERT INTO refund_disbursements 
                   (refund_id, order_id, user_id, payment_method, amount, status, notes, idempotency_key)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    refund_id,
                    payment.order_id,
                    order.user_id,
                    disbursementMethod,
                    refund.amount,
                    disbursementStatus,
                    disbursementNotes,
                    disbursementIdempotency
                  ]
                );
                await logFinancialEvent('refund_disbursement', refund_id, 'manual_refund_pending', 'admin', {
                  payment_method: disbursementMethod,
                  amount: refund.amount,
                  requires_manual_action: requiresManualAction,
                  notes: disbursementNotes
                });
              }
              refundDestination = {
                method: disbursementMethod,
                status: disbursementStatus,
                notes: disbursementNotes,
                requires_manual_action: requiresManualAction
              };
            }

            // 4. Adjust supplier payouts proportionally
            const orderItems = await database.all('SELECT * FROM order_items WHERE order_id = ?', [payment.order_id]);
            const supplierGroups = {};
            let totalOrderItemsSum = 0;
            orderItems.forEach(item => {
              if (!supplierGroups[item.supplier_id]) supplierGroups[item.supplier_id] = 0;
              supplierGroups[item.supplier_id] += item.line_total;
              totalOrderItemsSum += item.line_total;
            });

            for (const [supplierId, itemTotal] of Object.entries(supplierGroups)) {
              const shareFraction = totalOrderItemsSum > 0 ? itemTotal / totalOrderItemsSum : 0;
              const refundShare = refund.amount * shareFraction;

              const payout = await database.get(
                "SELECT * FROM supplier_payouts WHERE order_id = ? AND supplier_id = ? AND status != 'completed'",
                [payment.order_id, supplierId]
              );

              if (payout) {
                const updatedAmount = Math.max(0, payout.amount - refundShare);
                await database.run(
                  `UPDATE supplier_payouts
                   SET amount = ?, updated_at = datetime('now')
                   WHERE payout_id = ?`,
                  [updatedAmount, payout.payout_id]
                );
                await logFinancialEvent('payout', payout.payout_id, 'payout_adjusted', 'admin', {
                  supplier_id: supplierId,
                  refund_deduction: refundShare
                });
              }
            }
          } else {
            await logFinancialEvent('refund', refund_id, 'refund_rejected', 'admin', { reason: rejection_reason });
          }

          await database.run('COMMIT');
          return res.status(200).json({
            message: 'Refund status updated successfully.',
            status: newStatus,
            refund_destination: refundDestination
          });
        } catch (trxErr) {
          await database.run('ROLLBACK');
          throw trxErr;
        }
      } catch (err) {
        console.error('[Approve refund error]:', err.message);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    }
  };
};

module.exports = { createPayoutController };
