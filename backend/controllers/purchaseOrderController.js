const { isTransitionAllowed } = require('../services/purchaseOrderStateMachine');
const { adjustInventory } = require('../services/inventoryService');

const createPurchaseOrderController = (database) => {
  return {
    // ─── ADMIN ENDPOINTS ─────────────────────────────────────────────────────

    // GET /admin/purchase-orders
    getAdminPurchaseOrders: async (req, res) => {
      try {
        const purchaseOrders = await database.all(`
          SELECT po.*, 
                 u.username AS supplier_name,
                 u.email AS supplier_email,
                 creator.username AS creator_name,
                 (SELECT IFNULL(SUM(ordered_quantity), 0) FROM purchase_order_items WHERE po_id = po.po_id) AS total_ordered_items,
                 (SELECT IFNULL(SUM(received_quantity), 0) FROM purchase_order_items WHERE po_id = po.po_id) AS total_received_items
          FROM purchase_orders po
          JOIN users u ON po.supplier_id = u.user_id
          JOIN users creator ON po.created_by = creator.user_id
          ORDER BY po.created_at DESC
        `);

        const suppliers = await database.all(`
          SELECT user_id, username, email 
          FROM users 
          WHERE role = 'supplier' AND status = 'active'
          ORDER BY username ASC
        `);

        res.json({ purchaseOrders, suppliers });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    },

    // POST /admin/purchase-orders
    createPurchaseOrder: async (req, res) => {
      const { supplier_id, notes, items } = req.body;

      if (!supplier_id) {
        return res.status(400).json({ message: 'Supplier is required' });
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'At least one line item is required' });
      }

      try {
        // Validate supplier role
        const supplier = await database.get("SELECT role, status FROM users WHERE user_id = ?", [supplier_id]);
        if (!supplier || supplier.role !== 'supplier' || supplier.status !== 'active') {
          return res.status(400).json({ message: 'Selected user is not an active supplier' });
        }

        // Validate variants
        for (const item of items) {
          if (!item.variant_id || !item.ordered_quantity || item.ordered_quantity <= 0) {
            return res.status(400).json({ message: 'Invalid variant ID or ordered quantity' });
          }
          const variant = await database.get("SELECT variant_id FROM product_variants WHERE variant_id = ?", [item.variant_id]);
          if (!variant) {
            return res.status(400).json({ message: `Variant ID ${item.variant_id} does not exist` });
          }
        }

        await database.run('BEGIN TRANSACTION');

        try {
          const created_by = req.userId || 1;
          const poResult = await database.run(`
            INSERT INTO purchase_orders (supplier_id, status, notes, created_by, created_at, updated_at)
            VALUES (?, 'DRAFT', ?, ?, datetime('now'), datetime('now'))
          `, [supplier_id, notes || null, created_by]);

          const po_id = poResult.lastID;

          for (const item of items) {
            await database.run(`
              INSERT INTO purchase_order_items (po_id, variant_id, ordered_quantity, received_quantity, unit_cost, created_at)
              VALUES (?, ?, ?, 0, ?, datetime('now'))
            `, [po_id, item.variant_id, item.ordered_quantity, item.unit_cost || null]);
          }

          await database.run('COMMIT');
          res.status(201).json({ po_id, message: 'Purchase Order created in DRAFT status' });
        } catch (err) {
          await database.run('ROLLBACK');
          throw err;
        }
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    },

    // GET /admin/purchase-orders/:id
    getPurchaseOrderDetails: async (req, res) => {
      const { id } = req.params;
      try {
        const po = await database.get(`
          SELECT po.*, 
                 u.username AS supplier_name,
                 u.email AS supplier_email,
                 creator.username AS creator_name
          FROM purchase_orders po
          JOIN users u ON po.supplier_id = u.user_id
          JOIN users creator ON po.created_by = creator.user_id
          WHERE po.po_id = ?
        `, [id]);

        if (!po) {
          return res.status(404).json({ message: 'Purchase Order not found' });
        }

        const items = await database.all(`
          SELECT poi.*, 
                 pv.sku, 
                 pv.size, 
                 pv.color, 
                 p.product_name
          FROM purchase_order_items poi
          JOIN product_variants pv ON poi.variant_id = pv.variant_id
          JOIN products p ON pv.product_id = p.product_id
          WHERE poi.po_id = ?
        `, [id]);

        res.json({ ...po, items });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    },

    // PATCH /admin/purchase-orders/:id/status
    updatePurchaseOrderStatus: async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      try {
        const po = await database.get("SELECT status FROM purchase_orders WHERE po_id = ?", [id]);
        if (!po) {
          return res.status(404).json({ message: 'Purchase Order not found' });
        }

        const currentStatus = po.status;

        if (!isTransitionAllowed(currentStatus, status)) {
          return res.status(400).json({ 
            message: `Transition from ${currentStatus} to ${status} is forbidden` 
          });
        }

        let extraSet = '';
        if (status === 'SENT') {
          extraSet = `, sent_at = datetime('now')`;
        } else if (status === 'ACKNOWLEDGED') {
          extraSet = `, acknowledged_at = datetime('now')`;
        } else if (status === 'RECEIVED') {
          extraSet = `, received_at = datetime('now')`;
        }

        await database.run(`
          UPDATE purchase_orders 
          SET status = ?, updated_at = datetime('now')${extraSet} 
          WHERE po_id = ?
        `, [status, id]);

        res.json({ po_id: id, status, message: `Status updated to ${status}` });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    },

    // POST /admin/purchase-orders/:id/receive
    receivePurchaseOrderInventory: async (req, res) => {
      const { id } = req.params;
      const { items, notes } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Received items are required' });
      }

      await database.run('BEGIN TRANSACTION');

      try {
        const po = await database.get("SELECT status FROM purchase_orders WHERE po_id = ?", [id]);
        if (!po) {
          await database.run('ROLLBACK');
          return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Validate PO state
        if (po.status !== 'ACKNOWLEDGED' && po.status !== 'PARTIALLY_RECEIVED') {
          await database.run('ROLLBACK');
          return res.status(400).json({ 
            message: `Cannot receive stock on PO in status ${po.status}` 
          });
        }

        // Process item receipt and inventory adjustments
        for (const item of items) {
          const poItem = await database.get(`
            SELECT po_item_id, ordered_quantity, received_quantity 
            FROM purchase_order_items 
            WHERE po_id = ? AND variant_id = ?
          `, [id, item.variant_id]);

          if (!poItem) {
            await database.run('ROLLBACK');
            return res.status(400).json({ 
              message: `Variant ID ${item.variant_id} is not part of this Purchase Order` 
            });
          }

          const qty = parseInt(item.quantity, 10);
          if (isNaN(qty) || qty <= 0) {
            await database.run('ROLLBACK');
            return res.status(400).json({ message: 'Received quantity must be a positive integer' });
          }

          const newTotalReceived = poItem.received_quantity + qty;
          if (newTotalReceived > poItem.ordered_quantity) {
            await database.run('ROLLBACK');
            return res.status(400).json({ 
              message: `Over-receiving quantity is forbidden. Ordered: ${poItem.ordered_quantity}, Current Received: ${poItem.received_quantity}, New Input: ${qty}`
            });
          }

          // Update line item received quantity
          await database.run(`
            UPDATE purchase_order_items 
            SET received_quantity = ? 
            WHERE po_item_id = ?
          `, [newTotalReceived, poItem.po_item_id]);

          // Increase stock and log movement (using skipTransaction: true to avoid nested transaction error)
          await adjustInventory(database, {
            variant_id: item.variant_id,
            actor_user_id: req.userId || 1,
            movement_type: 'SUPPLIER_RESTOCK',
            quantity: qty,
            notes: notes || `Received from PO #${id}`,
            skipTransaction: true
          });
        }

        // Check if all lines are fully received
        const allItems = await database.all(`
          SELECT ordered_quantity, received_quantity 
          FROM purchase_order_items 
          WHERE po_id = ?
        `, [id]);

        const allReceived = allItems.every(i => i.ordered_quantity === i.received_quantity);
        const nextStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

        // Check transition validity
        if (!isTransitionAllowed(po.status, nextStatus)) {
          await database.run('ROLLBACK');
          return res.status(400).json({ 
            message: `Transitioning PO from ${po.status} to ${nextStatus} is forbidden` 
          });
        }

        let extraSet = '';
        if (nextStatus === 'RECEIVED') {
          extraSet = `, received_at = datetime('now')`;
        }

        await database.run(`
          UPDATE purchase_orders 
          SET status = ?, updated_at = datetime('now')${extraSet} 
          WHERE po_id = ?
        `, [nextStatus, id]);

        await database.run('COMMIT');
        res.json({ po_id: id, status: nextStatus, message: `Successfully received stock. PO status updated to ${nextStatus}` });
      } catch (err) {
        await database.run('ROLLBACK');
        res.status(500).json({ message: err.message });
      }
    },

    // ─── SUPPLIER ENDPOINTS ──────────────────────────────────────────────────

    // GET /supplier/purchase-orders
    getSupplierPurchaseOrders: async (req, res) => {
      const supplier_id = req.userId;
      try {
        const purchaseOrders = await database.all(`
          SELECT po.*, 
                 creator.username AS creator_name,
                 (SELECT IFNULL(SUM(ordered_quantity), 0) FROM purchase_order_items WHERE po_id = po.po_id) AS total_ordered_items,
                 (SELECT IFNULL(SUM(received_quantity), 0) FROM purchase_order_items WHERE po_id = po.po_id) AS total_received_items
          FROM purchase_orders po
          JOIN users creator ON po.created_by = creator.user_id
          WHERE po.supplier_id = ?
          ORDER BY po.created_at DESC
        `, [supplier_id]);

        res.json({ purchaseOrders });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    },

    // GET /supplier/purchase-orders/:id
    getSupplierPurchaseOrderDetails: async (req, res) => {
      const { id } = req.params;
      const supplier_id = req.userId;

      try {
        const po = await database.get(`
          SELECT po.*, 
                 creator.username AS creator_name
          FROM purchase_orders po
          JOIN users creator ON po.created_by = creator.user_id
          WHERE po.po_id = ?
        `, [id]);

        if (!po) {
          return res.status(404).json({ message: 'Purchase Order not found' });
        }

        if (po.supplier_id !== supplier_id) {
          return res.status(403).json({ message: 'Forbidden: Access to another supplier\'s Purchase Order is restricted' });
        }

        const items = await database.all(`
          SELECT poi.*, 
                 pv.sku, 
                 pv.size, 
                 pv.color, 
                 p.product_name
          FROM purchase_order_items poi
          JOIN product_variants pv ON poi.variant_id = pv.variant_id
          JOIN products p ON pv.product_id = p.product_id
          WHERE poi.po_id = ?
        `, [id]);

        res.json({ ...po, items });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    },

    // PATCH /supplier/purchase-orders/:id/acknowledge
    acknowledgePurchaseOrder: async (req, res) => {
      const { id } = req.params;
      const supplier_id = req.userId;

      try {
        const po = await database.get("SELECT supplier_id, status FROM purchase_orders WHERE po_id = ?", [id]);
        if (!po) {
          return res.status(404).json({ message: 'Purchase Order not found' });
        }

        if (po.supplier_id !== supplier_id) {
          return res.status(403).json({ message: 'Forbidden: Cannot acknowledge another supplier\'s Purchase Order' });
        }

        if (po.status !== 'SENT') {
          return res.status(400).json({ message: 'Only SENT Purchase Orders can be acknowledged' });
        }

        if (!isTransitionAllowed(po.status, 'ACKNOWLEDGED')) {
          return res.status(400).json({ message: 'Transition to ACKNOWLEDGED is forbidden' });
        }

        await database.run(`
          UPDATE purchase_orders 
          SET status = 'ACKNOWLEDGED', updated_at = datetime('now'), acknowledged_at = datetime('now') 
          WHERE po_id = ?
        `, [id]);

        res.json({ po_id: id, status: 'ACKNOWLEDGED', message: 'Purchase Order acknowledged successfully' });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    }
  };
};

module.exports = { createPurchaseOrderController };
