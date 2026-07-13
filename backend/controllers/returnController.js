const { getReturnEligibility } = require('../services/returnEligibility');
const { isTransitionAllowed, getAllowedActions, getStepIndex } = require('../services/returnStateMachine');
const { createNotification } = require('../services/notificationService');

const createReturnController = (database) => ({
  createReturn: async (req, res) => {
    const { id, variant_id } = req.params;
    const { request_type, reason_code, reason_description } = req.body;

    if (!request_type || !['return', 'replacement'].includes(request_type)) {
      return res.status(400).json({ message: 'Invalid or missing request_type' });
    }

    if (!reason_code || !['DAMAGED_ITEM', 'WRONG_ITEM_RECEIVED', 'MISSING_PARTS', 'NOT_AS_DESCRIBED', 'QUALITY_ISSUE', 'SIZE_ISSUE', 'CHANGED_MIND', 'OTHER'].includes(reason_code)) {
      return res.status(400).json({ message: 'Invalid or missing reason_code' });
    }

    try {
      const order = await database.get('SELECT user_id, status, order_number FROM orders WHERE order_id = ?', [id]);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      if (order.user_id !== req.userId) {
        return res.status(403).json({ message: 'Access denied: You do not own this order' });
      }

      const eligibility = await getReturnEligibility(database, id, variant_id);
      if (eligibility.status !== 'RETURN_ELIGIBLE' && eligibility.status !== 'REPLACEMENT_ELIGIBLE') {
        return res.status(400).json({ message: eligibility.message || 'Item is not eligible for return/replacement' });
      }

      if (request_type === 'return' && eligibility.status === 'REPLACEMENT_ELIGIBLE') {
        return res.status(400).json({ message: 'This item is only eligible for replacement, not return' });
      }

      const item = await database.get('SELECT order_item_id FROM order_items WHERE order_id = ? AND variant_id = ?', [id, variant_id]);
      if (!item) {
        return res.status(400).json({ message: 'Order item not found' });
      }

      await database.run('BEGIN TRANSACTION');

      try {
        const now = new Date().toISOString();
        const result = await database.run(
          `INSERT INTO returns (order_id, order_item_id, variant_id, user_id, request_type, reason_code, reason_description, status, requested_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?)`,
          [id, item.order_item_id, variant_id, req.userId, request_type, reason_code, reason_description || null, now, now, now]
        );

        const returnId = result.lastID;

        await database.run(
          `INSERT INTO return_events (return_id, previous_status, new_status, actor_user_id, actor_type, notes)
           VALUES (?, NULL, 'REQUESTED', ?, 'customer', ?)`,
          [returnId, req.userId, reason_description || 'Request submitted by customer']
        );

        // Generate transactional notification
        await createNotification(database, {
          user_id: req.userId,
          type: 'RETURN_REQUESTED',
          title: 'Return Requested',
          message: `Return request for order ${order.order_number} has been submitted.`,
          metadata: { return_id: returnId, order_id: Number(id) },
          event_key: `RETURN_REQUESTED:${returnId}`
        });

        await database.run('COMMIT');

        const createdReturn = await database.get('SELECT * FROM returns WHERE return_id = ?', [returnId]);
        res.status(201).json(createdReturn);
      } catch (err) {
        await database.run('ROLLBACK');
        throw err;
      }
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ message: 'An active return request already exists for this item' });
      }
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getMyReturns: async (req, res) => {
    try {
      const rows = await database.all(
        `SELECT r.*, p.product_name, p.image_url
         FROM returns r
         JOIN product_variants pv ON r.variant_id = pv.variant_id
         JOIN products p ON pv.product_id = p.product_id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC`,
        [req.userId]
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getReturnDetails: async (req, res) => {
    const { return_id } = req.params;
    try {
      const ret = await database.get(
        `SELECT r.*, o.order_number, p.product_name, p.image_url
         FROM returns r
         JOIN orders o ON r.order_id = o.order_id
         JOIN product_variants pv ON r.variant_id = pv.variant_id
         JOIN products p ON pv.product_id = p.product_id
         WHERE r.return_id = ?`,
        [return_id]
      );

      if (!ret) {
        return res.status(404).json({ message: 'Return request not found' });
      }

      if (ret.user_id !== req.userId && req.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const events = await database.all(
        `SELECT * FROM return_events WHERE return_id = ? ORDER BY created_at ASC`,
        [return_id]
      );

      const stepDetails = getStepIndex(ret.status, ret.request_type);

      res.json({
        ...ret,
        events,
        current_step_index: stepDetails.index,
        is_rejected: stepDetails.isRejected,
        allowed_actions: getAllowedActions(ret.status, ret.request_type)
      });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getAdminReturns: async (req, res) => {
    try {
      const rows = await database.all(
        `SELECT r.*, o.order_number, p.product_name, p.image_url, u.username
         FROM returns r
         JOIN orders o ON r.order_id = o.order_id
         JOIN product_variants pv ON r.variant_id = pv.variant_id
         JOIN products p ON pv.product_id = p.product_id
         JOIN users u ON r.user_id = u.user_id
         ORDER BY r.created_at DESC`
      );

      const mapped = rows.map(r => ({
        ...r,
        allowed_actions: getAllowedActions(r.status, r.request_type)
      }));

      res.json(mapped);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  updateReturnStatus: async (req, res) => {
    const { return_id } = req.params;
    const { status, admin_notes } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Missing next status value' });
    }

    try {
      const ret = await database.get('SELECT * FROM returns WHERE return_id = ?', [return_id]);
      if (!ret) {
        return res.status(404).json({ message: 'Return request not found' });
      }

      const allowed = isTransitionAllowed(ret.status, status, ret.request_type);
      if (!allowed) {
        return res.status(400).json({ message: `Invalid state transition from ${ret.status} to ${status}` });
      }

      await database.run('BEGIN TRANSACTION');

      try {
        const now = new Date().toISOString();
        let updateQuery = `UPDATE returns SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = ?`;
        const params = [status, admin_notes || null, now];

        if (status === 'APPROVED') {
          updateQuery += `, approved_at = ?`;
          params.push(now);
        } else if (status === 'REJECTED') {
          updateQuery += `, rejected_at = ?`;
          params.push(now);
        } else if (status === 'REFUND_COMPLETED' || status === 'REPLACEMENT_COMPLETED') {
          updateQuery += `, completed_at = ?`;
          params.push(now);
        }

        updateQuery += ` WHERE return_id = ?`;
        params.push(return_id);

        await database.run(updateQuery, params);

        await database.run(
          `INSERT INTO return_events (return_id, previous_status, new_status, actor_user_id, actor_type, notes)
           VALUES (?, ?, ?, ?, 'admin', ?)`,
          [return_id, ret.status, status, req.userId, admin_notes || `Status updated to ${status}`]
        );

        const order = await database.get('SELECT order_number FROM orders WHERE order_id = ?', [ret.order_id]);
        const orderNumber = order ? order.order_number : ret.order_id;

        let notifType = null;
        let notifTitle = null;
        let notifMessage = null;

        if (status === 'APPROVED') {
          notifType = 'RETURN_APPROVED';
          notifTitle = 'Return Approved';
          notifMessage = `Your return request for order ${orderNumber} has been approved.`;
        } else if (status === 'REJECTED') {
          notifType = 'RETURN_REJECTED';
          notifTitle = 'Return Rejected';
          notifMessage = `Your return request for order ${orderNumber} has been rejected.`;
        } else if (status === 'PICKUP_SCHEDULED') {
          notifType = 'PICKUP_SCHEDULED';
          notifTitle = 'Pickup Scheduled';
          notifMessage = `Pickup for your return on order ${orderNumber} has been scheduled.`;
        } else if (status === 'PICKED_UP') {
          notifType = 'RETURN_PICKED_UP';
          notifTitle = 'Return Picked Up';
          notifMessage = `Your return item for order ${orderNumber} has been picked up.`;
        } else if (status === 'RECEIVED') {
          notifType = 'RETURN_RECEIVED';
          notifTitle = 'Return Received';
          notifMessage = `We have received the returned item for order ${orderNumber}.`;
        } else if (status === 'REFUND_COMPLETED') {
          notifType = 'REFUND_COMPLETED';
          notifTitle = 'Refund Completed';
          notifMessage = `Refund for your return on order ${orderNumber} has been processed.`;
        } else if (status === 'REPLACEMENT_SHIPPED') {
          notifType = 'REPLACEMENT_SHIPPED';
          notifTitle = 'Replacement Shipped';
          notifMessage = `The replacement item for order ${orderNumber} has been shipped.`;
        }

        if (notifType) {
          await createNotification(database, {
            user_id: ret.user_id,
            type: notifType,
            title: notifTitle,
            message: notifMessage,
            metadata: { return_id: Number(return_id), order_id: ret.order_id },
            event_key: `${notifType}:${return_id}`
          });
        }

        await database.run('COMMIT');
        res.json({ message: 'Return status updated successfully' });
      } catch (err) {
        await database.run('ROLLBACK');
        throw err;
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  }
});

module.exports = { createReturnController };
