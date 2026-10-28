const crypto = require('crypto');

const createPaymentController = (database) => {
  // Helper to check idempotency key
  const checkIdempotency = async (key, type) => {
    if (!key) return null;
    if (type === 'payment') {
      return await database.get("SELECT * FROM payments WHERE idempotency_key = ?", [key]);
    } else if (type === 'refund') {
      return await database.get("SELECT * FROM refunds WHERE idempotency_key = ?", [key]);
    } else if (type === 'wallet') {
      return await database.get("SELECT * FROM wallet_transactions WHERE idempotency_key = ?", [key]);
    }
    return null;
  };

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

  // Helper to get platform commission settings
  const getCommissionSettings = async () => {
    const settings = await database.all("SELECT key, value FROM platform_settings");
    const map = {};
    settings.forEach(s => { map[s.key] = parseFloat(s.value); });
    return {
      pct: map.commission_percentage ?? 10.0,
      flat: map.fixed_transaction_fee ?? 15.0,
      min: map.minimum_commission ?? 0.0,
      max: map.maximum_commission ?? 10000.0
    };
  };

  return {
    // ─── Initiate Payment ───
    initiatePayment: async (req, res) => {
      const { order_id, payment_method } = req.body;
      const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotency_key;

      if (!order_id || !payment_method) {
        return res.status(400).json({ message: 'Order ID and payment method are required.' });
      }

      try {
        // 1. Idempotency Check
        const existing = await checkIdempotency(idempotencyKey, 'payment');
        if (existing) {
          return res.status(200).json(existing);
        }

        // 2. Fetch Order
        const order = await database.get("SELECT * FROM orders WHERE order_id = ?", [order_id]);
        if (!order) {
          return res.status(404).json({ message: 'Order not found.' });
        }

        if (order.user_id !== req.userId && req.role !== 'admin') {
          return res.status(403).json({ message: 'Forbidden. You do not own this order.' });
        }

        // 3. Check order paid status
        if (order.payment_status === 'paid') {
          return res.status(400).json({ message: 'Order has already been paid.' });
        }

        // Check if there is already an active successful payment attempt
        const activePayment = await database.get(
          "SELECT * FROM payments WHERE order_id = ? AND status IN ('captured', 'completed')",
          [order_id]
        );
        if (activePayment) {
          return res.status(400).json({ message: 'Order has an active successful payment.' });
        }

        const amount = order.total_amount;

        // 4. If WALLET payment, check ledger balance
        if (payment_method === 'WALLET') {
          const ledgerSum = await database.get(
            `SELECT SUM(CASE WHEN type IN ('deposit', 'refund', 'adjustment_credit') THEN amount ELSE -amount END) AS balance 
             FROM wallet_transactions WHERE user_id = ?`,
            [req.userId]
          );
          const currentBalance = ledgerSum ? (ledgerSum.balance || 0) : 0;
          if (currentBalance < amount) {
            return res.status(400).json({ message: 'Insufficient wallet balance.' });
          }
        }

        // 5. Generate transaction reference
        const ref = 'PAY-' + crypto.randomBytes(8).toString('hex').toUpperCase();

        // 6. Insert payment row
        await database.run('BEGIN TRANSACTION');
        try {
          const result = await database.run(
            `INSERT INTO payments (order_id, payment_method, status, amount, transaction_reference, idempotency_key)
             VALUES (?, ?, 'created', ?, ?, ?)`,
            [order_id, payment_method, amount, ref, idempotencyKey || null]
          );
          const payment_id = result.lastID;

          // Update order's payment method in case of retry switch
          await database.run("UPDATE orders SET payment_method = ? WHERE order_id = ?", [payment_method, order_id]);

          // Log payment events
          await database.run(
            `INSERT INTO payment_events (payment_id, previous_state, new_state, actor, metadata)
             VALUES (?, NULL, 'created', 'customer', ?)`,
            [payment_id, JSON.stringify({ message: 'Payment initiated by customer.' })]
          );

          await logFinancialEvent('payment', payment_id, 'payment_created', 'customer', { order_id, amount });
          await logTelemetryEvent('payment_initiated', req.userId, null, null, { order_id, payment_id, amount });

          await database.run('COMMIT');

          const newPayment = await database.get("SELECT * FROM payments WHERE payment_id = ?", [payment_id]);
          return res.status(201).json(newPayment);
        } catch (trxErr) {
          await database.run('ROLLBACK');
          throw trxErr;
        }
      } catch (err) {
        console.error('[Payment initiate error]:', err.message);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Simulate Gateway Payment Outcome ───
    simulatePayment: async (req, res) => {
      const { payment_id, outcome, failure_reason } = req.body;

      if (!payment_id || !outcome) {
        return res.status(400).json({ message: 'Payment ID and outcome are required.' });
      }

      try {
        const payment = await database.get("SELECT * FROM payments WHERE payment_id = ?", [payment_id]);
        if (!payment) {
          return res.status(404).json({ message: 'Payment record not found.' });
        }

        if (payment.status === 'completed' || payment.status === 'failed') {
          return res.status(400).json({ message: `Payment is already in final state: ${payment.status}` });
        }

        const order = await database.get("SELECT * FROM orders WHERE order_id = ?", [payment.order_id]);
        if (!order) {
          return res.status(404).json({ message: 'Associated order not found.' });
        }

        const prevStatus = payment.status;
        let newStatus = 'processing';
        let orderPaymentStatus = 'pending';
        let orderStatus = order.status;

        if (outcome === 'success') {
          newStatus = 'completed';
          orderPaymentStatus = 'paid';
          orderStatus = 'processing'; // Transition to Confirmed/Processing
        } else if (outcome === 'failure' || outcome === 'timeout') {
          newStatus = 'failed';
          orderPaymentStatus = 'failed';
        } else if (outcome === 'cancelled') {
          newStatus = 'cancelled';
          orderPaymentStatus = 'failed';
        } else if (outcome === 'expired') {
          newStatus = 'expired';
          orderPaymentStatus = 'failed';
        } else if (outcome === 'pending') {
          newStatus = 'processing';
          orderPaymentStatus = 'pending';
        }

        await database.run('BEGIN TRANSACTION');
        try {
          // 1. Update Payment Status
          await database.run(
            `UPDATE payments 
             SET status = ?, gateway_outcome = ?, failure_reason = ?, updated_at = datetime('now')
             WHERE payment_id = ?`,
            [newStatus, outcome, failure_reason || null, payment_id]
          );

          // 2. Log Payment Event
          await database.run(
            `INSERT INTO payment_events (payment_id, previous_state, new_state, actor, metadata)
             VALUES (?, ?, ?, 'system', ?)`,
            [payment_id, prevStatus, newStatus, JSON.stringify({ outcome, failure_reason })]
          );

          // 3. Update Order Status
          await database.run(
            `UPDATE orders 
             SET payment_status = ?, status = ?, updated_at = datetime('now')
             WHERE order_id = ?`,
            [orderPaymentStatus, orderStatus, payment.order_id]
          );

          // Log order audit event
          await database.run(
            `INSERT INTO order_events (order_id, status, message)
             VALUES (?, ?, ?)`,
            [payment.order_id, orderStatus, `Order status synced. Payment: ${orderPaymentStatus}.`]
          );

          // 4. Financial Audit Event & Telemetry
          if (outcome === 'success') {
            await logFinancialEvent('payment', payment_id, 'payment_completed', 'system', { order_id: payment.order_id });
            await logTelemetryEvent('payment_success', order.user_id, null, null, { order_id: payment.order_id, payment_id });

            // If WALLET payment, debit client wallet
            if (payment.payment_method === 'WALLET') {
              const walletRef = `order:${payment.order_id}`;
              const walletIdempotency = `wallet-debit-${payment.payment_id}`;
              await database.run(
                `INSERT INTO wallet_transactions (user_id, type, amount, reference_id, idempotency_key)
                 VALUES (?, 'payment', ?, ?, ?)`,
                [order.user_id, payment.amount, walletRef, walletIdempotency]
              );
              const walletTxRow = await database.get("SELECT last_insert_rowid() AS id");
              await logFinancialEvent('wallet_transaction', walletTxRow.id, 'wallet_debited', 'system', { user_id: order.user_id, amount: payment.amount });
              await logTelemetryEvent('wallet_debit', order.user_id, null, null, { order_id: payment.order_id, amount: payment.amount });
            }

            // 5. Generate protected Payout records for each supplier in the order
            const orderItems = await database.all("SELECT * FROM order_items WHERE order_id = ?", [payment.order_id]);
            const supplierGroups = {};
            orderItems.forEach(item => {
              if (!supplierGroups[item.supplier_id]) supplierGroups[item.supplier_id] = 0;
              supplierGroups[item.supplier_id] += item.line_total;
            });

            const comms = await getCommissionSettings();

            for (const [supplierId, itemTotal] of Object.entries(supplierGroups)) {
              let commission = (itemTotal * comms.pct / 100) + comms.flat;
              if (commission < comms.min) commission = comms.min;
              if (commission > comms.max) commission = comms.max;
              const netPayout = itemTotal - commission;

              const payoutIdempotency = `payout-${payment.order_id}-${supplierId}`;
              await database.run(
                `INSERT INTO supplier_payouts (supplier_id, order_id, amount, commission_deducted, platform_fee_deducted, status, timeline, idempotency_key)
                 VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
                [supplierId, payment.order_id, netPayout, commission, comms.flat, JSON.stringify({ created_at: new Date() }), payoutIdempotency]
              );

              const payoutRow = await database.get("SELECT last_insert_rowid() AS id");
              await logFinancialEvent('payout', payoutRow.id, 'payout_created', 'system', { supplier_id: supplierId, amount: netPayout });
            }
          } else {
            await logFinancialEvent('payment', payment_id, 'payment_failed', 'system', { order_id: payment.order_id, reason: failure_reason });
            await logTelemetryEvent('payment_failed', order.user_id, null, null, { order_id: payment.order_id, payment_id, reason: failure_reason });
          }

          await database.run('COMMIT');
          return res.status(200).json({ message: 'Payment state transitioned successfully.', status: newStatus });
        } catch (trxErr) {
          await database.run('ROLLBACK');
          throw trxErr;
        }
      } catch (err) {
        console.error('[Payment simulation error]:', err.message);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Switch Method & Retry Payment ───
    retryPayment: async (req, res) => {
      const { order_id, payment_method } = req.body;
      const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotency_key;

      if (!order_id || !payment_method) {
        return res.status(400).json({ message: 'Order ID and payment method are required.' });
      }

      try {
        // 1. Idempotency Check
        const existing = await checkIdempotency(idempotencyKey, 'payment');
        if (existing) {
          return res.status(200).json(existing);
        }

        const order = await database.get("SELECT * FROM orders WHERE order_id = ?", [order_id]);
        if (!order) {
          return res.status(404).json({ message: 'Order not found.' });
        }

        if (order.user_id !== req.userId && req.role !== 'admin') {
          return res.status(403).json({ message: 'Forbidden.' });
        }

        if (order.payment_status === 'paid') {
          return res.status(400).json({ message: 'Order is already paid.' });
        }

        // Limit retries if too many failures in 5 mins
        const recentFailures = await database.get(
          `SELECT COUNT(*) AS count FROM payments 
           WHERE order_id = ? AND status = 'failed' AND created_at > datetime('now', '-5 minutes')`,
          [order_id]
        );
        if (recentFailures && recentFailures.count >= 5) {
          return res.status(429).json({ message: 'Too many payment attempts. Please retry in 5 minutes.' });
        }

        const amount = order.total_amount;

        // WALLET balance check
        if (payment_method === 'WALLET') {
          const ledgerSum = await database.get(
            `SELECT SUM(CASE WHEN type IN ('deposit', 'refund', 'adjustment_credit') THEN amount ELSE -amount END) AS balance 
             FROM wallet_transactions WHERE user_id = ?`,
            [req.userId]
          );
          const currentBalance = ledgerSum ? (ledgerSum.balance || 0) : 0;
          if (currentBalance < amount) {
            return res.status(400).json({ message: 'Insufficient wallet balance.' });
          }
        }

        const ref = 'PAY-' + crypto.randomBytes(8).toString('hex').toUpperCase();

        await database.run('BEGIN TRANSACTION');
        try {
          const result = await database.run(
            `INSERT INTO payments (order_id, payment_method, status, amount, transaction_reference, idempotency_key)
             VALUES (?, ?, 'created', ?, ?, ?)`,
            [order_id, payment_method, amount, ref, idempotencyKey || null]
          );
          const payment_id = result.lastID;

          await database.run("UPDATE orders SET payment_method = ?, payment_status = 'pending' WHERE order_id = ?", [payment_method, order_id]);

          await database.run(
            `INSERT INTO payment_events (payment_id, previous_state, new_state, actor, metadata)
             VALUES (?, NULL, 'created', 'customer', ?)`,
            [payment_id, JSON.stringify({ message: 'Payment retried / method switched.' })]
          );

          await logFinancialEvent('payment', payment_id, 'payment_created', 'customer', { order_id, amount, is_retry: true });
          await logTelemetryEvent('payment_retry', req.userId, null, null, { order_id, payment_id });

          await database.run('COMMIT');

          const newPayment = await database.get("SELECT * FROM payments WHERE payment_id = ?", [payment_id]);
          return res.status(201).json(newPayment);
        } catch (trxErr) {
          await database.run('ROLLBACK');
          throw trxErr;
        }
      } catch (err) {
        console.error('[Payment retry error]:', err.message);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Request Refund ───
    requestRefund: async (req, res) => {
      const { payment_id, amount, reason } = req.body;
      const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotency_key;

      if (!payment_id || !amount || amount <= 0 || !reason) {
        return res.status(400).json({ message: 'Payment ID, positive amount, and reason are required.' });
      }

      try {
        const existing = await checkIdempotency(idempotencyKey, 'refund');
        if (existing) {
          return res.status(200).json(existing);
        }

        const payment = await database.get("SELECT * FROM payments WHERE payment_id = ?", [payment_id]);
        if (!payment) {
          return res.status(404).json({ message: 'Payment not found.' });
        }

        if (payment.status !== 'completed' && payment.status !== 'captured') {
          return res.status(400).json({ message: 'Refunds can only be requested on successful payments.' });
        }

        const order = await database.get("SELECT * FROM orders WHERE order_id = ?", [payment.order_id]);
        if (order.user_id !== req.userId && req.role !== 'admin') {
          return res.status(403).json({ message: 'Forbidden. You do not own this order.' });
        }

        // Sum existing refunds
        const refundsSum = await database.get(
          "SELECT SUM(amount) AS total FROM refunds WHERE payment_id = ? AND status IN ('requested', 'approved', 'processing', 'completed')",
          [payment_id]
        );
        const totalRefunded = refundsSum ? (refundsSum.total || 0) : 0;
        if (amount + totalRefunded > payment.amount) {
          return res.status(400).json({ message: 'Refund amount exceeds captured payment total.' });
        }

        const result = await database.run(
          `INSERT INTO refunds (payment_id, amount, reason, status, idempotency_key)
           VALUES (?, ?, ?, 'requested', ?)`,
          [payment_id, amount, reason, idempotencyKey || null]
        );
        const refund_id = result.lastID;

        await logFinancialEvent('refund', refund_id, 'refund_requested', 'customer', { payment_id, amount });
        await logTelemetryEvent('refund_requested', req.userId, null, null, { payment_id, amount });

        const newRefund = await database.get("SELECT * FROM refunds WHERE refund_id = ?", [refund_id]);
        return res.status(201).json(newRefund);
      } catch (err) {
        console.error('[Refund request error]:', err.message);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Wallet Deposit ───
    walletDeposit: async (req, res) => {
      const { amount } = req.body;
      const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotency_key;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Positive amount is required.' });
      }

      try {
        const existing = await checkIdempotency(idempotencyKey, 'wallet');
        if (existing) {
          return res.status(200).json(existing);
        }

        const result = await database.run(
          `INSERT INTO wallet_transactions (user_id, type, amount, reference_id, idempotency_key)
           VALUES (?, 'deposit', ?, 'manual_deposit', ?)`,
          [req.userId, amount, idempotencyKey || null]
        );
        const txId = result.lastID;

        await logFinancialEvent('wallet_transaction', txId, 'wallet_credited', 'customer', { user_id: req.userId, amount });
        await logTelemetryEvent('wallet_credit', req.userId, null, null, { amount });

        const tx = await database.get("SELECT * FROM wallet_transactions WHERE id = ?", [txId]);
        return res.status(201).json(tx);
      } catch (err) {
        console.error('[Wallet deposit error]:', err.message);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Wallet Balance ───
    getWalletBalance: async (req, res) => {
      try {
        const ledgerSum = await database.get(
          `SELECT SUM(CASE WHEN type IN ('deposit', 'refund', 'adjustment_credit') THEN amount ELSE -amount END) AS balance 
           FROM wallet_transactions WHERE user_id = ?`,
          [req.userId]
        );
        const balance = ledgerSum ? (ledgerSum.balance || 0) : 0;
        return res.status(200).json({ balance });
      } catch (err) {
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Wallet History ───
    getWalletHistory: async (req, res) => {
      try {
        const list = await database.all(
          "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC",
          [req.userId]
        );
        return res.status(200).json(list);
      } catch (err) {
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Customer Transaction History ───
    getTransactionHistory: async (req, res) => {
      try {
        const paymentsList = await database.all(
          `SELECT p.*, o.order_number 
           FROM payments p
           JOIN orders o ON p.order_id = o.order_id
           WHERE o.user_id = ? 
           ORDER BY p.created_at DESC`,
          [req.userId]
        );

        const refundsList = await database.all(
          `SELECT r.*, p.transaction_reference, o.order_number
           FROM refunds r
           JOIN payments p ON r.payment_id = p.payment_id
           JOIN orders o ON p.order_id = o.order_id
           WHERE o.user_id = ?
           ORDER BY r.created_at DESC`,
          [req.userId]
        );

        return res.status(200).json({ payments: paymentsList, refunds: refundsList });
      } catch (err) {
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    },

    // ─── Admin: Mark COD Cash as Collected ───
    // Decision: COD cash is considered "paid" the moment admin confirms physical collection.
    // A payment row is created with method=COD, status=completed, and the order is moved to paid.
    // This gives a full audit trail without requiring a real payment gateway.
    markCodCollected: async (req, res) => {
      if (req.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden. Admin access required.' });
      }

      const { order_id, notes } = req.body;
      if (!order_id) {
        return res.status(400).json({ message: 'order_id is required' });
      }

      try {
        const order = await database.get('SELECT * FROM orders WHERE order_id = ?', [order_id]);
        if (!order) {
          return res.status(404).json({ message: 'Order not found.' });
        }

        if (order.payment_method !== 'COD') {
          return res.status(400).json({ message: 'Order is not a COD order.' });
        }

        if (order.payment_status === 'paid') {
          return res.status(400).json({ message: 'COD cash has already been marked as collected for this order.' });
        }

        const ref = 'COD-' + crypto.randomBytes(8).toString('hex').toUpperCase();

        await database.run('BEGIN TRANSACTION');
        try {
          // Create a completed payment record for COD collection
          const result = await database.run(
            `INSERT INTO payments (order_id, payment_method, status, amount, transaction_reference, idempotency_key)
             VALUES (?, 'COD', 'completed', ?, ?, ?)`,
            [order_id, order.total_amount, ref, `cod-collect-${order_id}`]
          );
          const payment_id = result.lastID;

          // Log payment state event
          await database.run(
            `INSERT INTO payment_events (payment_id, previous_state, new_state, actor, metadata)
             VALUES (?, NULL, 'completed', 'admin', ?)`,
            [payment_id, JSON.stringify({ message: 'COD cash collected by admin.', notes: notes || null, admin_id: req.userId })]
          );

          // Update order payment status to paid
          await database.run(
            `UPDATE orders SET payment_status = 'paid', updated_at = datetime('now') WHERE order_id = ?`,
            [order_id]
          );

          // Log order event for audit trail
          await database.run(
            `INSERT INTO order_events (order_id, status, message)
             VALUES (?, ?, ?)`,
            [order_id, order.status, `COD cash collected by admin (ref: ${ref}). ${notes ? 'Notes: ' + notes : ''}`]
          );

          await logFinancialEvent('payment', payment_id, 'cod_cash_collected', 'admin', {
            order_id,
            amount: order.total_amount,
            admin_id: req.userId,
            notes: notes || null
          });
          await logTelemetryEvent('cod_collected', req.userId, null, null, { order_id, payment_id });

          // Generate payout records for suppliers now that cash is confirmed
          const orderItems = await database.all('SELECT * FROM order_items WHERE order_id = ?', [order_id]);
          const supplierGroups = {};
          orderItems.forEach(item => {
            if (!supplierGroups[item.supplier_id]) supplierGroups[item.supplier_id] = 0;
            supplierGroups[item.supplier_id] += item.line_total;
          });

          const comms = await getCommissionSettings();
          for (const [supplierId, itemTotal] of Object.entries(supplierGroups)) {
            let commission = (itemTotal * comms.pct / 100) + comms.flat;
            if (commission < comms.min) commission = comms.min;
            if (commission > comms.max) commission = comms.max;
            const netPayout = itemTotal - commission;

            const payoutIdempotency = `payout-${order_id}-${supplierId}-cod`;
            // Only create if payout doesn't already exist
            const existingPayout = await database.get(
              'SELECT payout_id FROM supplier_payouts WHERE idempotency_key = ?',
              [payoutIdempotency]
            );
            if (!existingPayout) {
              await database.run(
                `INSERT INTO supplier_payouts (supplier_id, order_id, amount, commission_deducted, platform_fee_deducted, status, timeline, idempotency_key)
                 VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
                [supplierId, order_id, netPayout, commission, comms.flat, JSON.stringify({ created_at: new Date() }), payoutIdempotency]
              );
            }
          }

          await database.run('COMMIT');
          const updatedOrder = await database.get('SELECT payment_status, payment_method FROM orders WHERE order_id = ?', [order_id]);
          return res.status(200).json({
            message: 'COD cash marked as collected. Order payment status updated to paid.',
            transaction_reference: ref,
            payment_id,
            payment_status: updatedOrder.payment_status
          });
        } catch (trxErr) {
          await database.run('ROLLBACK');
          throw trxErr;
        }
      } catch (err) {
        console.error('[COD collect error]:', err.message);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    }
  };
};

module.exports = { createPaymentController };
