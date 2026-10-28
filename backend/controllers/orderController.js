const { validateCouponAndCalculateDiscount } = require('../services/couponService');
const { createNotification } = require('../services/notificationService');

const createOrderController = (database, sendOrderEmail) => ({
  getMyOrders: async (req, res) => {
    try {
      const ordersList = await database.all(
        `SELECT 
          o.order_id, 
          o.order_number, 
          o.status, 
          o.placed_at AS created_at, 
          o.subtotal_amount AS subtotal, 
          o.total_amount,
          o.payment_method,
          SUM(oi.quantity) AS item_count,
          (
            SELECT p.product_name 
            FROM order_items oi2
            JOIN product_variants pv ON oi2.variant_id = pv.variant_id
            JOIN products p ON pv.product_id = p.product_id
            WHERE oi2.order_id = o.order_id
            LIMIT 1
          ) AS first_product_name,
          (
            SELECT p.image_url 
            FROM order_items oi2
            JOIN product_variants pv ON oi2.variant_id = pv.variant_id
            JOIN products p ON pv.product_id = p.product_id
            WHERE oi2.order_id = o.order_id
            LIMIT 1
          ) AS first_product_image
        FROM orders o
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        WHERE o.user_id = ?
        GROUP BY o.order_id
        ORDER BY o.placed_at DESC`,
        [req.userId]
      );
      res.json(ordersList);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getOrder: async (req, res) => {
    const { id } = req.params;
    try {
      const order = await database.get(
        'SELECT * FROM orders WHERE order_id = ?',
        [id]
      );
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      if (order.user_id !== req.userId && req.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const items = await database.all(
        `SELECT oi.*, pv.product_id, pv.size, pv.color, p.product_name, p.image_url
         FROM order_items oi
         JOIN product_variants pv ON oi.variant_id = pv.variant_id
         JOIN products p ON pv.product_id = p.product_id
         WHERE oi.order_id = ?`,
        [id]
      );

      const returnEligibilityService = require('../services/returnEligibility');
      const enrichedItems = [];
      for (const item of items) {
        const eligibility = await returnEligibilityService.getReturnEligibility(database, id, item.variant_id);
        enrichedItems.push({
          ...item,
          return_eligibility: eligibility
        });
      }

      res.json({ ...order, items: enrichedItems });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  cancelOrder: async (req, res) => {
    const { id } = req.params;
    try {
      const order = await database.get('SELECT * FROM orders WHERE order_id = ?', [id]);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      if (order.user_id !== req.userId && req.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const status = order.status ? order.status.toLowerCase() : '';
      if (status !== 'pending') {
        return res.status(400).json({ message: 'Order cannot be cancelled at its current status: ' + order.status });
      }

      await database.run('BEGIN TRANSACTION');
      try {
        await database.run(
          `UPDATE orders 
           SET status = 'cancelled', updated_at = datetime('now') 
           WHERE order_id = ?`,
          [id]
        );

        // Insert event record
        await database.run(
          `INSERT INTO order_events (order_id, status, message)
           VALUES (?, 'cancelled', 'Order cancelled by customer.')`,
          [id]
        );

        // Generate transactional notification
        await createNotification(database, {
          user_id: order.user_id,
          type: 'ORDER_CANCELLED',
          title: 'Order Cancelled',
          message: `Your order ${order.order_number} has been cancelled.`,
          metadata: { order_id: Number(id), order_number: order.order_number },
          event_key: `ORDER_CANCELLED:${id}`
        });

        // Fetch order items to restock
        const items = await database.all(
          `SELECT variant_id, quantity FROM order_items WHERE order_id = ?`,
          [id]
        );

        // Increment variant available stock & log movement
        for (const item of items) {
          const invBefore = await database.get('SELECT available_stock FROM inventory WHERE variant_id = ?', [item.variant_id]);
          const previous_quantity = invBefore ? invBefore.available_stock : 0;
          const new_quantity = previous_quantity + item.quantity;

          await database.run(
            `UPDATE inventory 
             SET available_stock = ?, updated_at = datetime('now') 
             WHERE variant_id = ?`,
            [new_quantity, item.variant_id]
          );

          await database.run(
            `INSERT INTO inventory_movements (variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, notes, created_at)
             VALUES (?, ?, 'ORDER_CANCELLATION_RESTOCK', ?, ?, ?, ?, datetime('now'))`,
            [item.variant_id, req.userId, item.quantity, previous_quantity, new_quantity, `Order cancelled: ${order.order_number}`]
          );
        }

        await database.run('COMMIT');
        res.json({ message: 'Order cancelled successfully' });
      } catch (txErr) {
        await database.run('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  placeOrder: async (request, response) => {
    const { name, email, address, phone, paymentMethod, cart_id, coupon_code } = request.body;

    if (!cart_id) {
      return response.status(400).json({ message: 'cart_id is required.' });
    }

    if (!name || !email || !address || !paymentMethod) {
      return response.status(400).json({ message: 'Missing required fields: name, email, address, paymentMethod' });
    }

    const validMethods = ['Cash', 'COD', 'UPI'];
    if (!validMethods.includes(paymentMethod)) {
      return response.status(400).json({ message: 'Invalid payment method. Accepted: Cash, COD, UPI' });
    }

    try {
      const activeCart = await database.get(
        `SELECT cart_id FROM cart WHERE cart_id = ? AND user_id = ? AND status = 'active'`,
        [cart_id, request.userId]
      );

      if (!activeCart) {
        return response.status(400).json({ message: 'No active cart found. Please add items to your cart first.' });
      }

      const cartItems = await database.all(`
        SELECT ci.variant_id, ci.quantity, ci.unit_price,
               p.product_name, p.product_id, p.supplier_id,
               i.available_stock, pv.sku,
               IFNULL(ps.free_shipping, 0) AS free_shipping
        FROM cart_items ci
        JOIN product_variants pv ON ci.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN inventory i ON pv.variant_id = i.variant_id
        LEFT JOIN product_shipping ps ON p.product_id = ps.product_id
        WHERE ci.cart_id = ?
      `, [activeCart.cart_id]);

      if (cartItems.length === 0) {
        return response.status(400).json({ message: 'Cart is empty' });
      }

      for (const item of cartItems) {
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          return response.status(400).json({ message: `Invalid quantity for product ${item.product_name}` });
        }
      }

      for (const item of cartItems) {
        const stock = item.available_stock || 0;
        if (stock < item.quantity) {
          return response.status(400).json({ message: `Insufficient stock for: ${item.product_name}` });
        }
      }

      // ─── Pricing & Coupon calculations (Phase 5F) ──────────────────────
      const { calculateOrderSummary } = require('../services/pricingService');
      const summaryResult = await calculateOrderSummary(database, request.userId, coupon_code);
      if (coupon_code && !summaryResult.coupon_valid) {
        return response.status(400).json({ message: summaryResult.coupon_message });
      }

      const subtotal = summaryResult.subtotal;
      const shipping = summaryResult.shipping_fee;
      const tax = summaryResult.tax_amount;
      const discountAmount = summaryResult.coupon_savings;
      const total = summaryResult.final_total;
      const appliedCouponId = summaryResult.coupon_id;
      const couponCodeSnapshot = coupon_code ? coupon_code.toUpperCase() : null;

      const now = new Date();
      const dateStr = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
      const seq = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
      const orderNumber = `ORD-${dateStr}-${seq}`;
      const dbMethod = paymentMethod === 'UPI' ? 'UPI' : 'COD';

      await database.run('BEGIN TRANSACTION');
      try {
        const createOrderQuery = `
          INSERT INTO orders
            (user_id, order_number, status, payment_method, payment_status,
             subtotal_amount, shipping_amount, tax_amount, total_amount,
             customer_name, customer_email, address_line_1, customer_phone,
             coupon_id, discount_amount, coupon_code_snapshot)
          VALUES (?, ?, 'pending', ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await database.run(createOrderQuery, [
          request.userId,
          orderNumber,
          dbMethod,
          subtotal,
          shipping,
          tax,
          total,
          name,
          email,
          address,
          phone || '',
          appliedCouponId,
          discountAmount,
          couponCodeSnapshot
        ]);
        const order_id = result.lastID;

        // Insert event record
        await database.run(
          `INSERT INTO order_events (order_id, status, message)
           VALUES (?, 'placed', 'Order placed successfully.')`,
          [order_id]
        );

        // Generate transactional notification
        await createNotification(database, {
          user_id: request.userId,
          type: 'ORDER_PLACED',
          title: 'Order Placed',
          message: `Your order ${orderNumber} has been placed successfully.`,
          metadata: { order_id, order_number: orderNumber },
          event_key: `ORDER_PLACED:${order_id}`
        });

        const emailItems = [];
        for (const item of cartItems) {
          const line_total = item.unit_price * item.quantity;
          await database.run(
            `INSERT INTO order_items (order_id, variant_id, supplier_id, quantity, unit_price, line_total)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [order_id, item.variant_id, item.supplier_id, item.quantity, item.unit_price, line_total]
          );

          const invBefore = await database.get('SELECT available_stock FROM inventory WHERE variant_id = ?', [item.variant_id]);
          if (!invBefore) {
            throw new Error(`Inventory record not found for variant ID ${item.variant_id}`);
          }
          const previous_quantity = invBefore.available_stock;
          const new_quantity = previous_quantity - item.quantity;

          if (new_quantity < 0) {
            throw new Error(`Insufficient stock for ${item.product_name}`);
          }

          const invResult = await database.run(
            `UPDATE inventory
             SET available_stock = ?, updated_at = datetime('now')
             WHERE variant_id = ?`,
            [new_quantity, item.variant_id]
          );
          if (invResult.changes === 0) {
            throw new Error(`Inventory update failed for ${item.product_name} — possible stock discrepancy`);
          }

          // Log Inventory Movement
          await database.run(
            `INSERT INTO inventory_movements (variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, notes, created_at)
             VALUES (?, ?, 'ORDER_SALE', ?, ?, ?, ?, datetime('now'))`,
            [item.variant_id, request.userId || 1, -item.quantity, previous_quantity, new_quantity, `Order placed: ${orderNumber}`]
          );

          // Check if reorder level reached, generate active alert if needed
          const inv = await database.get(
            `SELECT available_stock, reorder_level FROM inventory WHERE variant_id = ?`,
            [item.variant_id]
          );
          if (inv && inv.available_stock <= inv.reorder_level) {
            const type = inv.available_stock === 0 ? 'out_of_stock' : 'low_stock';
            const severity = inv.available_stock === 0 ? 'critical' : 'warning';
            
            // Check if active alert already exists to prevent duplication
            const activeAlert = await database.get(
              `SELECT alert_id FROM alerts WHERE type = ? AND variant_id = ? AND resolved_at IS NULL`,
              [type, item.variant_id]
            );
            if (!activeAlert) {
              await database.run(
                `INSERT INTO alerts (type, severity, product_id, variant_id, message)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  type,
                  severity,
                  item.product_id,
                  item.variant_id,
                  `Stock alert for SKU ${item.sku}. Available: ${inv.available_stock}`
                ]
              );
            }
          }

          emailItems.push({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price
          });
        }

        // ─── Coupon redemption record (Phase 5D) ──────────────────────
        if (appliedCouponId) {
          await database.run(
            `INSERT INTO coupon_redemptions (coupon_id, order_id, user_id, discount_amount)
             VALUES (?, ?, ?, ?)`,
            [appliedCouponId, order_id, request.userId, discountAmount]
          );

          // Generate transactional notification
          await createNotification(database, {
            user_id: request.userId,
            type: 'COUPON_APPLIED',
            title: 'Coupon Applied',
            message: `Coupon ${couponCodeSnapshot} has been applied to your order.`,
            metadata: { coupon_id: appliedCouponId, coupon_code: couponCodeSnapshot, order_id },
            event_key: `COUPON_APPLIED:${order_id}`
          });
        }

        await database.run('DELETE FROM cart_items WHERE cart_id = ?', [activeCart.cart_id]);
        await database.run("UPDATE cart SET status = 'converted', updated_at = datetime('now') WHERE cart_id = ?", [activeCart.cart_id]);

        await database.run('COMMIT');

        try {
          await sendOrderEmail(orderNumber, name, email, address, dbMethod, emailItems, total, phone || '');
        } catch (emailErr) {
          console.error('Email notification failed (order preserved):', emailErr.message);
        }

        const orderResponse = { message: 'Order placed successfully', order_id, order_number: orderNumber };
        if (appliedCouponId) {
          orderResponse.discount_amount = discountAmount;
        }
        response.status(201).json(orderResponse);
      } catch (txErr) {
        await database.run('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      response.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  createOrderRequest: async (req, res) => {
    const { id } = req.params;
    const { request_type, reason } = req.body;
    if (!request_type || !['cancel', 'return', 'replacement'].includes(request_type)) {
      return res.status(400).json({ message: 'Missing or invalid request_type' });
    }
    try {
      const order = await database.get('SELECT * FROM orders WHERE order_id = ?', [id]);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      if (order.user_id !== req.userId) {
        return res.status(403).json({ message: 'Unauthorized access to order' });
      }
      
      if (request_type === 'cancel' && !['pending', 'processing'].includes(order.status)) {
        return res.status(400).json({ message: 'Order cannot be cancelled at its current status: ' + order.status });
      }
      if (request_type === 'return' && order.status !== 'delivered') {
        return res.status(400).json({ message: 'Only delivered orders can be returned' });
      }
      if (request_type === 'replacement' && order.status !== 'delivered') {
        return res.status(400).json({ message: 'Only delivered orders can be replaced' });
      }

      const existing = await database.get(
        `SELECT request_id FROM order_requests WHERE order_id = ? AND request_type = ? AND status = 'pending'`,
        [id, request_type]
      );
      if (existing) {
        return res.status(409).json({ message: 'A pending request of this type already exists for this order' });
      }

      await database.run(
        `INSERT INTO order_requests (order_id, user_id, request_type, reason, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [id, req.userId, request_type, reason || null]
      );
      
      res.status(201).json({ message: 'Request submitted successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getOrderEvents: async (req, res) => {
    const { id } = req.params;
    try {
      const order = await database.get('SELECT user_id FROM orders WHERE order_id = ?', [id]);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      if (order.user_id !== req.userId && req.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const events = await database.all(
        'SELECT status, message, created_at FROM order_events WHERE order_id = ? ORDER BY created_at ASC',
        [id]
      );
      res.json(events);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getItemEligibility: async (req, res) => {
    const { id, variant_id } = req.params;
    try {
      const order = await database.get('SELECT user_id FROM orders WHERE order_id = ?', [id]);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      if (order.user_id !== req.userId && req.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const returnEligibilityService = require('../services/returnEligibility');
      const eligibility = await returnEligibilityService.getReturnEligibility(database, id, variant_id);
      res.json(eligibility);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },
});

module.exports = { createOrderController };
