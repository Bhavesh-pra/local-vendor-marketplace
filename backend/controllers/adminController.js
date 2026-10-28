/**
 * adminController — all admin-only business logic.
 *
 * Security: Every method here is already behind authenticateHeader + requireAdmin
 * middleware. No admin emails or secrets are exposed in any response body.
 *
 * Order status DB values: pending | confirmed | packed | out_for_delivery | delivered | cancelled
 * UI labels are applied on the frontend.
 */
const fs = require('fs');
const path = require('path');
const { createNotification } = require('../services/notificationService');
const inventoryService = require('../services/inventoryService');

const getFullUrl = (req, filePath) => {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}${filePath}`;
};

const createAdminController = (database) => ({

  // ─── Dashboard ────────────────────────────────────────────────────────────

  getDashboardStats: async (req, res) => {
    try {
      const [
        revenueToday,
        revenueThisWeek,
        revenueThisMonth,
        revenueAvg,
        revenueTotal,
        ordersToday,
        ordersPending,
        ordersConfirmed,
        ordersShipped,
        ordersDelivered,
        ordersCancelled,
        invLowStock,
        invOutOfStock,
        invTotal,
        invActive,
        invInactive,
        returnsActive,
        returnsPending,
        returnsApproved,
        returnsCompleted,
        returnsRejected,
        bestSellingProducts,
        worstSellingProducts,
        highestRatedProducts,
        mostReturnedProducts
      ] = await Promise.all([
        // Revenue Today (delivered only)
        database.get("SELECT IFNULL(SUM(total_amount), 0) AS total FROM orders WHERE status = 'delivered' AND date(placed_at) = date('now')"),
        // Revenue This Week (delivered only)
        database.get("SELECT IFNULL(SUM(total_amount), 0) AS total FROM orders WHERE status = 'delivered' AND placed_at >= datetime('now', '-7 days')"),
        // Revenue This Month (delivered only)
        database.get("SELECT IFNULL(SUM(total_amount), 0) AS total FROM orders WHERE status = 'delivered' AND strftime('%Y-%m', placed_at) = strftime('%Y-%m', 'now')"),
        // Average Order Value (delivered only)
        database.get("SELECT IFNULL(AVG(total_amount), 0) AS avg FROM orders WHERE status = 'delivered'"),
        // Total Revenue (delivered only)
        database.get("SELECT IFNULL(SUM(total_amount), 0) AS total FROM orders WHERE status = 'delivered'"),

        // Orders Today
        database.get("SELECT COUNT(*) AS count FROM orders WHERE date(placed_at) = date('now')"),
        // Pending Orders
        database.get("SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'"),
        // Confirmed Orders (processing)
        database.get("SELECT COUNT(*) AS count FROM orders WHERE status = 'processing'"),
        // Shipped Orders
        database.get("SELECT COUNT(*) AS count FROM orders WHERE status = 'shipped'"),
        // Delivered Orders
        database.get("SELECT COUNT(*) AS count FROM orders WHERE status = 'delivered'"),
        // Cancelled Orders
        database.get("SELECT COUNT(*) AS count FROM orders WHERE status = 'cancelled'"),

        // Low Stock Products (stock <= 10 and stock > 0, active/inactive variants only, excluding archived)
        database.get(`
          SELECT COUNT(DISTINCT pv.product_id) AS count
          FROM inventory i
          JOIN product_variants pv ON i.variant_id = pv.variant_id
          JOIN products p ON pv.product_id = p.product_id
          WHERE i.available_stock <= 10 AND i.available_stock > 0
            AND pv.status <> 'archived'
            AND p.product_status <> 'archived'
        `),
        // Out of Stock Products (stock = 0, active/inactive variants only, excluding archived)
        database.get(`
          SELECT COUNT(DISTINCT pv.product_id) AS count
          FROM inventory i
          JOIN product_variants pv ON i.variant_id = pv.variant_id
          JOIN products p ON pv.product_id = p.product_id
          WHERE i.available_stock = 0
            AND pv.status <> 'archived'
            AND p.product_status <> 'archived'
        `),
        // Total Products (excluding archived)
        database.get("SELECT COUNT(*) AS count FROM products WHERE product_status <> 'archived'"),
        // Active Products
        database.get("SELECT COUNT(*) AS count FROM products WHERE product_status = 'active'"),
        // Inactive Products
        database.get("SELECT COUNT(*) AS count FROM products WHERE product_status = 'inactive'"),

        // Active Returns
        database.get("SELECT COUNT(*) AS count FROM returns WHERE status IN ('REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REPLACEMENT_SHIPPED', 'REFUNDED')"),
        // Pending Returns
        database.get("SELECT COUNT(*) AS count FROM returns WHERE status = 'REQUESTED'"),
        // Approved Returns
        database.get("SELECT COUNT(*) AS count FROM returns WHERE status = 'APPROVED'"),
        // Completed Returns
        database.get("SELECT COUNT(*) AS count FROM returns WHERE status IN ('REFUND_COMPLETED', 'REPLACEMENT_COMPLETED')"),
        // Rejected Returns
        database.get("SELECT COUNT(*) AS count FROM returns WHERE status = 'REJECTED'"),

        // Best Selling Products (Top 5)
        database.all(`
          SELECT p.product_id AS id, p.product_name AS name, SUM(oi.quantity) AS units_sold, SUM(oi.line_total) AS revenue
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.order_id
          JOIN product_variants pv ON oi.variant_id = pv.variant_id
          JOIN products p ON pv.product_id = p.product_id
          WHERE o.status = 'delivered'
          GROUP BY p.product_id, p.product_name
          ORDER BY units_sold DESC, revenue DESC
          LIMIT 5
        `),
        // Worst Selling Products (Top 5, including products with 0 sales)
        database.all(`
          SELECT p.product_id AS id, p.product_name AS name,
                 IFNULL(SUM(CASE WHEN o.status = 'delivered' THEN oi.quantity ELSE 0 END), 0) AS units_sold,
                 IFNULL(SUM(CASE WHEN o.status = 'delivered' THEN oi.line_total ELSE 0 END), 0) AS revenue
          FROM products p
          LEFT JOIN product_variants pv ON p.product_id = pv.product_id
          LEFT JOIN order_items oi ON pv.variant_id = oi.variant_id
          LEFT JOIN orders o ON oi.order_id = o.order_id
          WHERE p.product_status <> 'archived'
          GROUP BY p.product_id, p.product_name
          ORDER BY units_sold ASC, revenue ASC
          LIMIT 5
        `),
        // Highest Rated Products (Top 5)
        database.all(`
          SELECT p.product_id AS id, p.product_name AS name, ROUND(AVG(r.rating), 2) AS rating, SUM(CASE WHEN r.order_item_id IS NOT NULL THEN 1 ELSE 0 END) AS verified_reviews
          FROM reviews r
          JOIN products p ON r.product_id = p.product_id
          WHERE p.product_status <> 'archived'
          GROUP BY p.product_id, p.product_name
          ORDER BY rating DESC, verified_reviews DESC
          LIMIT 5
        `),
        // Most Returned Products (Top 5)
        database.all(`
          SELECT 
            p.product_id AS id, 
            p.product_name AS name, 
            COUNT(ret.return_id) AS return_count,
            IFNULL(ROUND(CAST(COUNT(ret.return_id) AS REAL) / (
              SELECT IFNULL(SUM(oi2.quantity), 1)
              FROM order_items oi2
              JOIN orders o2 ON oi2.order_id = o2.order_id
              JOIN product_variants pv2 ON oi2.variant_id = pv2.variant_id
              WHERE pv2.product_id = p.product_id AND o2.status = 'delivered'
            ), 4), 0) AS return_rate
          FROM returns ret
          JOIN product_variants pv ON ret.variant_id = pv.variant_id
          JOIN products p ON pv.product_id = p.product_id
          WHERE p.product_status <> 'archived'
          GROUP BY p.product_id, p.product_name
          ORDER BY return_count DESC, return_rate DESC
          LIMIT 5
        `)
      ]);

      res.json({
        revenue: {
          revenue_today: revenueToday.total,
          revenue_this_week: revenueThisWeek.total,
          revenue_this_month: revenueThisMonth.total,
          average_order_value: revenueAvg.avg,
          total_revenue: revenueTotal.total
        },
        orders: {
          orders_today: ordersToday.count,
          pending_orders: ordersPending.count,
          confirmed_orders: ordersConfirmed.count,
          shipped_orders: ordersShipped.count,
          delivered_orders: ordersDelivered.count,
          cancelled_orders: ordersCancelled.count
        },
        inventory: {
          low_stock_products: invLowStock.count,
          out_of_stock_products: invOutOfStock.count,
          total_products: invTotal.count,
          active_products: invActive.count,
          inactive_products: invInactive.count
        },
        products: {
          best_selling_products: bestSellingProducts,
          worst_selling_products: worstSellingProducts,
          highest_rated_products: highestRatedProducts,
          most_returned_products: mostReturnedProducts
        },
        returns: {
          active_returns: returnsActive.count,
          pending_returns: returnsPending.count,
          approved_returns: returnsApproved.count,
          completed_returns: returnsCompleted.count,
          rejected_returns: returnsRejected.count
        }
      });
    } catch (err) {
      console.error('[admin] getDashboardStats:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  // ─── Analytics ───────────────────────────────────────────────────────────

  getAnalytics: async (req, res) => {
    try {
      const [
        revenueByDay,
        revenueByMonth,
        ordersByStatus,
        newCustomersThisWeek,
        newCustomersThisMonth,
        totalCustomers,
        bestSelling,
        categoryPerformance,
        requestStats,
        requestTypeStats,
      ] = await Promise.all([
        // Revenue per day — last 30 days
        database.all(`
          SELECT DATE(placed_at) AS date,
                 ROUND(SUM(total_amount), 2) AS revenue,
                 COUNT(*) AS orders
          FROM orders
          WHERE status != 'cancelled'
            AND placed_at >= datetime('now', '-30 days')
          GROUP BY DATE(placed_at)
          ORDER BY date ASC
        `),
        // Revenue per month — last 12 months
        database.all(`
          SELECT strftime('%Y-%m', placed_at) AS month,
                 ROUND(SUM(total_amount), 2) AS revenue,
                 COUNT(*) AS orders
          FROM orders
          WHERE status != 'cancelled'
            AND placed_at >= datetime('now', '-12 months')
          GROUP BY strftime('%Y-%m', placed_at)
          ORDER BY month ASC
        `),
        // Orders by status
        database.all(`
          SELECT status, COUNT(*) AS count
          FROM orders
          GROUP BY status
        `),
        // New customers this week
        database.get(`
          SELECT COUNT(*) AS count FROM users
          WHERE role = 'customer' AND created_at >= datetime('now', '-7 days')
        `),
        // New customers this month
        database.get(`
          SELECT COUNT(*) AS count FROM users
          WHERE role = 'customer' AND created_at >= datetime('now', '-30 days')
        `),
        // Total customers
        database.get(`SELECT COUNT(*) AS count FROM users WHERE role = 'customer'`),
        // Best selling products (top 5 by units sold)
        database.all(`
          SELECT p.product_id,
                 p.product_name,
                 p.image_url,
                 p.selling_price,
                 SUM(oi.quantity)   AS total_quantity,
                 ROUND(SUM(oi.line_total), 2) AS total_revenue,
                 COUNT(DISTINCT oi.order_id)  AS order_count
          FROM order_items oi
          JOIN product_variants pv ON oi.variant_id = pv.variant_id
          JOIN products p ON pv.product_id = p.product_id
          GROUP BY p.product_id
          ORDER BY total_quantity DESC
          LIMIT 5
        `),
        // Category performance
        database.all(`
          SELECT c.category_name,
                 ROUND(SUM(oi.line_total), 2) AS revenue,
                 SUM(oi.quantity) AS quantity
          FROM order_items oi
          JOIN product_variants pv ON oi.variant_id = pv.variant_id
          JOIN products p   ON pv.product_id  = p.product_id
          JOIN categories c ON p.category_id  = c.category_id
          GROUP BY c.category_id
          ORDER BY revenue DESC
        `),
        // Request counts by status
        database.all(`
          SELECT status, COUNT(*) AS count
          FROM order_requests
          GROUP BY status
        `),
        // Request counts by type
        database.all(`
          SELECT request_type, COUNT(*) AS count
          FROM order_requests
          GROUP BY request_type
        `),
      ]);

      res.json({
        revenueByDay,
        revenueByMonth,
        ordersByStatus,
        customers: {
          thisWeek: newCustomersThisWeek.count,
          thisMonth: newCustomersThisMonth.count,
          total: totalCustomers.count,
        },
        bestSelling,
        categoryPerformance,
        requestStats,
        requestTypeStats,
      });
    } catch (err) {
      console.error('[admin] getAnalytics:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  // ─── Products ─────────────────────────────────────────────────────────────

  getAllProducts: async (req, res) => {
    try {
      const products = await database.all(`
        SELECT p.product_id,
               p.product_name,
               p.brand,
               p.short_description,
               p.slug,
               p.selling_price,
               p.cost_price,
               p.image_url,
               p.product_status,
               p.size_or_quantity,
               p.description,
               p.created_at,
               p.updated_at,
               c.category_name,
               c.category_id,
               COUNT(DISTINCT pv.variant_id) AS variants_count,
               IFNULL(SUM(i.available_stock), 0) AS stock,
               IFNULL(ROUND(AVG(r.rating), 1), 0) AS average_rating,
               COUNT(DISTINCT r.review_id) AS review_count
        FROM products p
        LEFT JOIN categories c  ON p.category_id  = c.category_id
        LEFT JOIN product_variants pv ON p.product_id = pv.product_id
        LEFT JOIN inventory  i  ON pv.variant_id   = i.variant_id
        LEFT JOIN reviews    r  ON p.product_id   = r.product_id
        WHERE p.product_status <> 'archived'
        GROUP BY p.product_id
        ORDER BY p.created_at DESC
      `);
      
      const mapped = products.map(p => ({
        ...p,
        image_url: getFullUrl(req, p.image_url)
      }));
      res.json(mapped);
    } catch (err) {
      console.error('[admin] getAllProducts:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getCategories: async (req, res) => {
    try {
      const categories = await database.all(
        `SELECT category_id, category_name FROM categories WHERE is_active = 1 ORDER BY category_name`
      );
      res.json(categories);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getSuppliers: async (req, res) => {
    try {
      const suppliers = await database.all(
        `SELECT supplier_id, supplier_name FROM suppliers WHERE supplier_status = 'active' ORDER BY supplier_name`
      );
      res.json(suppliers);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  updateProduct: async (req, res) => {
    const { id } = req.params;
    const {
      product_name,
      brand,
      category_id,
      description,
      short_description,
      slug,
      selling_price,
      cost_price,
      mrp,
      badge,
      image_url,
      product_status,
      media,
      variants,
      specifications,
      warranty,
      shipping,
      return_policy_id
    } = req.body;

    try {
      const existing = await database.get(
        'SELECT * FROM products WHERE product_id = ?',
        [id]
      );
      if (!existing) return res.status(404).json({ message: 'Product not found' });

      await database.run('BEGIN TRANSACTION');

      const primary_image = media?.cover || image_url;
      const base_selling = (selling_price !== undefined && selling_price !== '') ? parseFloat(selling_price) : (variants?.[0]?.selling_price ? parseFloat(variants[0].selling_price) : null);
      const base_cost = (cost_price !== undefined && cost_price !== '') ? parseFloat(cost_price) : (variants?.[0]?.cost_price ? parseFloat(variants[0].cost_price) : null);
      const base_mrp = (mrp !== undefined && mrp !== '') ? parseFloat(mrp) : (variants?.[0]?.mrp ? parseFloat(variants[0].mrp) : null);
      const sizeSpec = variants?.[0]?.size || null;

      const checkSelling = base_selling !== null ? base_selling : existing.selling_price;
      const checkCost = base_cost !== null ? base_cost : existing.cost_price;
      const checkMrp = base_mrp !== null ? base_mrp : (existing.mrp || checkSelling);

      if (checkSelling < 0 || checkCost < 0 || checkMrp < 0) {
        throw new Error('Prices must be non-negative');
      }
      if (checkSelling < checkCost) {
        throw new Error('Selling price cannot be less than cost price');
      }
      if (checkMrp < checkSelling) {
        throw new Error('MRP cannot be less than selling price');
      }

      let finalSlug = slug || existing.slug;
      if (!finalSlug || (product_name && product_name !== existing.product_name && !slug)) {
        finalSlug = `${(product_name || existing.product_name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}-${id}`;
      }

      await database.run(`
        UPDATE products SET
          product_name      = COALESCE(?, product_name),
          brand             = COALESCE(?, brand),
          category_id       = COALESCE(?, category_id),
          description       = COALESCE(?, description),
          short_description = COALESCE(?, short_description),
          slug              = COALESCE(?, slug),
          selling_price     = COALESCE(?, selling_price),
          cost_price        = COALESCE(?, cost_price),
          mrp               = COALESCE(?, mrp),
          image_url         = COALESCE(?, image_url),
          size_or_quantity  = COALESCE(?, size_or_quantity),
          product_status    = COALESCE(?, product_status),
          badge             = COALESCE(?, badge),
          return_policy_id  = COALESCE(?, return_policy_id),
          updated_at        = datetime('now')
        WHERE product_id = ?
      `, [
        product_name || null,
        brand || null,
        category_id || null,
        description || null,
        short_description || null,
        finalSlug,
        base_selling,
        base_cost,
        base_mrp,
        primary_image || null,
        sizeSpec,
        product_status || null,
        badge || null,
        return_policy_id !== undefined ? return_policy_id : null,
        id
      ]);

      if (specifications && Array.isArray(specifications)) {
        await database.run(`DELETE FROM product_attributes WHERE product_id = ?`, [id]);
        for (const spec of specifications) {
          if (spec.name && spec.value) {
            await database.run(
              `INSERT INTO product_attributes (product_id, attribute_name, attribute_value, is_highlight) VALUES (?, ?, ?, ?)`,
              [id, spec.name.trim(), spec.value.trim(), spec.is_highlight ? 1 : 0]
            );
          }
        }
      }

      if (warranty) {
        const hasWarranty = await database.get('SELECT warranty_id FROM product_warranty WHERE product_id = ?', [id]);
        if (hasWarranty) {
          await database.run(
            `UPDATE product_warranty SET
              warranty_period  = ?,
              warranty_type    = ?,
              replacement_days = ?,
              return_days      = ?,
              description      = ?
             WHERE product_id = ?`,
            [
              warranty.warranty_period || null,
              warranty.warranty_type || null,
              parseInt(warranty.replacement_days || 0, 10),
              parseInt(warranty.return_days || 0, 10),
              warranty.description || null,
              id
            ]
          );
        } else {
          await database.run(
            `INSERT INTO product_warranty (product_id, warranty_period, warranty_type, replacement_days, return_days, description)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              id,
              warranty.warranty_period || null,
              warranty.warranty_type || null,
              parseInt(warranty.replacement_days || 0, 10),
              parseInt(warranty.return_days || 0, 10),
              warranty.description || null
            ]
          );
        }
      }

      if (shipping) {
        const hasShipping = await database.get('SELECT shipping_id FROM product_shipping WHERE product_id = ?', [id]);
        if (hasShipping) {
          await database.run(
            `UPDATE product_shipping SET
              weight        = ?,
              length        = ?,
              width         = ?,
              height        = ?,
              shipping_class = ?,
              cod_available = ?,
              free_shipping = ?
             WHERE product_id = ?`,
            [
              shipping.weight !== undefined ? parseFloat(shipping.weight) : null,
              shipping.length !== undefined ? parseFloat(shipping.length) : null,
              shipping.width !== undefined ? parseFloat(shipping.width) : null,
              shipping.height !== undefined ? parseFloat(shipping.height) : null,
              shipping.shipping_class || null,
              shipping.cod_available ? 1 : 0,
              shipping.free_shipping ? 1 : 0,
              id
            ]
          );
        } else {
          await database.run(
            `INSERT INTO product_shipping (product_id, weight, length, width, height, shipping_class, cod_available, free_shipping)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              shipping.weight !== undefined ? parseFloat(shipping.weight) : null,
              shipping.length !== undefined ? parseFloat(shipping.length) : null,
              shipping.width !== undefined ? parseFloat(shipping.width) : null,
              shipping.height !== undefined ? parseFloat(shipping.height) : null,
              shipping.shipping_class || null,
              shipping.cod_available ? 1 : 0,
              shipping.free_shipping ? 1 : 0
            ]
          );
        }
      }

      if (variants && Array.isArray(variants)) {
        const currentVariants = await database.all('SELECT variant_id, sku FROM product_variants WHERE product_id = ?', [id]);
        const currentIds = currentVariants.map(v => v.variant_id);
        const incomingIds = variants.map(v => v.variant_id).filter(Boolean);

        const toDelete = currentIds.filter(cid => !incomingIds.includes(cid));
        for (const vid of toDelete) {
          await database.run(`UPDATE product_variants SET status = 'archived' WHERE variant_id = ?`, [vid]);
          await database.run(`DELETE FROM inventory WHERE variant_id = ?`, [vid]);
        }

        const supplier_id = existing.supplier_id;
        let isFirst = true;

        for (const v of variants) {
          if (v.variant_id) {
            await database.run(
              `UPDATE product_variants SET
                sku            = COALESCE(?, sku),
                size           = ?,
                color          = COALESCE(?, color),
                version        = ?,
                weight         = ?,
                storage        = ?,
                model          = ?,
                barcode        = ?,
                price_override = ?,
                cost_override  = ?,
                mrp_override   = ?,
                is_default     = ?,
                status         = 'active',
                updated_at     = datetime('now')
               WHERE variant_id = ?`,
              [
                v.sku || null,
                v.size || null,
                v.color || 'Default',
                v.version || null,
                v.weight || null,
                v.storage || null,
                v.model || null,
                v.barcode || null,
                v.selling_price !== undefined ? parseFloat(v.selling_price) : null,
                v.cost_price !== undefined ? parseFloat(v.cost_price) : null,
                v.mrp !== undefined ? parseFloat(v.mrp) : null,
                isFirst ? 1 : 0,
                v.variant_id
              ]
            );

            if (v.stock !== undefined) {
              const currentInv = await database.get('SELECT available_stock FROM inventory WHERE variant_id = ?', [v.variant_id]);
              const newStock = parseInt(v.stock, 10);
              const oldStock = currentInv ? currentInv.available_stock : 0;
              const change = newStock - oldStock;

              if (currentInv) {
                await database.run(
                  `UPDATE inventory SET 
                     available_stock = ?, 
                     reorder_level = ?, 
                     purchase_price = ?,
                     updated_at = datetime('now') 
                   WHERE variant_id = ?`,
                  [newStock, parseInt(v.reorder_level || 10, 10), v.cost_price !== undefined ? parseFloat(v.cost_price) : base_cost, v.variant_id]
                );
              } else {
                await database.run(
                  `INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price, last_restock_date)
                   VALUES (?, ?, ?, 0, ?, ?, datetime('now'))`,
                  [v.variant_id, supplier_id, newStock, parseInt(v.reorder_level || 10, 10), v.cost_price !== undefined ? parseFloat(v.cost_price) : base_cost]
                );
              }

              if (change !== 0) {
                const movement_type = change > 0 ? 'SUPPLIER_RESTOCK' : 'MANUAL_CORRECTION';
                await database.run(
                  `INSERT INTO inventory_movements (variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, notes, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, 'Stock updated via product edit', datetime('now'))`,
                  [v.variant_id, req.userId || 1, movement_type, change, oldStock, newStock]
                );
              }
            }
          } else {
            const uniqueSku = v.sku || `SKU-${id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
            const variantResult = await database.run(
              `INSERT INTO product_variants 
                (product_id, sku, size, color, version, weight, storage, model, barcode, price_override, cost_override, mrp_override, is_default, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
              [
                id,
                uniqueSku,
                v.size || null,
                v.color || 'Default',
                v.version || null,
                v.weight || null,
                v.storage || null,
                v.model || null,
                v.barcode || null,
                v.selling_price !== undefined ? parseFloat(v.selling_price) : null,
                v.cost_price !== undefined ? parseFloat(v.cost_price) : null,
                v.mrp !== undefined ? parseFloat(v.mrp) : null,
                isFirst ? 1 : 0
              ]
            );
            const variant_id = variantResult.lastID;

            const initialStock = parseInt(v.stock || 0, 10);
            const reorderLevel = parseInt(v.reorder_level || 10, 10);
            const purchaseCost = v.cost_price !== undefined ? parseFloat(v.cost_price) : base_cost;
            await database.run(
              `INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price, last_restock_date)
               VALUES (?, ?, ?, 0, ?, ?, datetime('now'))`,
              [variant_id, supplier_id, initialStock, reorderLevel, purchaseCost]
            );

            if (initialStock > 0) {
              await database.run(
                `INSERT INTO inventory_movements (variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, notes, created_at)
                 VALUES (?, ?, 'SUPPLIER_RESTOCK', ?, 0, ?, 'Initial stock on variant creation', datetime('now'))`,
                [variant_id, req.userId || 1, initialStock, initialStock]
              );
            }
          }
          isFirst = false;
        }
      }

      if (media) {
        await database.run(`DELETE FROM product_media WHERE product_id = ?`, [id]);
        await database.run(`DELETE FROM product_images WHERE product_id = ?`, [id]);

        let mediaPosition = 0;
        if (primary_image) {
          await database.run(
            `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
             VALUES (?, NULL, 'image', ?, ?, ?, 1)`,
            [id, primary_image, media.coverAlt || 'Cover image', mediaPosition++]
          );
          await database.run(
            `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
             VALUES (?, ?, 1, 0)`,
            [id, primary_image]
          );
        }

        if (media.gallery && Array.isArray(media.gallery)) {
          for (let index = 0; index < media.gallery.length; index++) {
            const img = media.gallery[index];
            const alt = media.galleryAlts?.[index] || 'Gallery image';
            if (img && img !== primary_image) {
              await database.run(
                `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
                 VALUES (?, NULL, 'image', ?, ?, ?, 0)`,
                [id, img, alt, mediaPosition]
              );
              await database.run(
                `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
                 VALUES (?, ?, 0, ?)`,
                [id, img, mediaPosition]
              );
              mediaPosition++;
            }
          }
        }

        if (media.video) {
          await database.run(
            `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
             VALUES (?, NULL, 'video', ?, ?, ?, 0)`,
            [id, media.video, media.videoAlt || 'Product video', mediaPosition++]
          );
        }

        if (media.variantMedia && Array.isArray(media.variantMedia)) {
          const updatedVars = await database.all('SELECT variant_id, size, color FROM product_variants WHERE product_id = ? AND status <> ?', [id, 'archived']);
          for (const vm of media.variantMedia) {
            const targetVar = updatedVars.find(v => (v.size === vm.size || (!v.size && !vm.size)) && (v.color === vm.color));
            if (targetVar && vm.file_path) {
              await database.run(
                `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
                 VALUES (?, ?, 'image', ?, ?, ?, 0)`,
                [id, targetVar.variant_id, vm.file_path, vm.alt_text || 'Variant image', mediaPosition++]
              );
            }
          }
        }
      }

      await database.run('COMMIT');
      if (global.clearSearchVocabularyCache) {
        global.clearSearchVocabularyCache();
      }
      res.json({ message: 'Product updated successfully' });
    } catch (err) {
      await database.run('ROLLBACK');
      console.error('[admin] updateProduct:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  setProductStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'inactive', 'archived'].includes(status)) {
      return res.status(400).json({ message: 'Status must be active, inactive or archived' });
    }
    try {
      const result = await database.run(
        `UPDATE products SET product_status = ?, updated_at = datetime('now') WHERE product_id = ?`,
        [status, id]
      );
      if (result.changes === 0) return res.status(404).json({ message: 'Product not found' });
      if (global.clearSearchVocabularyCache) {
        global.clearSearchVocabularyCache();
      }
      res.json({ message: `Product set to ${status}` });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  uploadFile: async (req, res) => {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) {
      return res.status(400).json({ message: 'fileName and fileData are required' });
    }
    try {
      const { validateUploadedFile } = require('../middleware/security');
      let validated;
      try {
        validated = validateUploadedFile(fileName, fileData, ['image', 'video']);
      } catch (validationErr) {
        return res.status(400).json({ message: validationErr.message });
      }

      const ext = path.extname(fileName) || '.jpg';
      const isVideo = ext.toLowerCase() === '.mp4';
      const subFolder = isVideo ? 'videos' : 'products';
      
      const uploadDir = path.join(__dirname, '../uploads', subFolder);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, validated.uniqueName);
      fs.writeFileSync(filePath, validated.buffer);
      
      const relativePath = `/uploads/${subFolder}/${validated.uniqueName}`;
      res.json({ fileUrl: relativePath });
    } catch (err) {
      console.error('[admin] uploadFile:', err.message);
      res.status(500).json({ message: 'Upload error: ' + err.message });
    }
  },

  duplicateProduct: async (req, res) => {
    const { id } = req.params;
    try {
      const prod = await database.get('SELECT * FROM products WHERE product_id = ?', [id]);
      if (!prod) return res.status(404).json({ message: 'Product not found' });

      await database.run('BEGIN TRANSACTION');

      const copyName = `${prod.product_name} (Copy)`;
      const copySlug = `${prod.product_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}-copy-${Date.now().toString(36)}`;
      
      const productResult = await database.run(
        `INSERT INTO products 
          (supplier_id, category_id, product_name, brand, description, short_description, slug, sku, manufacture_date, cost_price, selling_price, image_url, size_or_quantity, product_status, return_policy_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
        [
          prod.supplier_id,
          prod.category_id,
          copyName,
          prod.brand || null,
          prod.description,
          prod.short_description || null,
          copySlug,
          null,
          prod.manufacture_date || null,
          prod.cost_price,
          prod.selling_price,
          prod.image_url || null,
          prod.size_or_quantity || null,
          prod.return_policy_id || null
        ]
      );
      const new_product_id = productResult.lastID;

      const attrs = await database.all('SELECT * FROM product_attributes WHERE product_id = ?', [id]);
      for (const attr of attrs) {
        await database.run(
          `INSERT INTO product_attributes (product_id, attribute_name, attribute_value) VALUES (?, ?, ?)`,
          [new_product_id, attr.attribute_name, attr.attribute_value]
        );
      }

      const warranty = await database.get('SELECT * FROM product_warranty WHERE product_id = ?', [id]);
      if (warranty) {
        await database.run(
          `INSERT INTO product_warranty (product_id, warranty_period, warranty_type, replacement_days, return_days, description)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            new_product_id,
            warranty.warranty_period || null,
            warranty.warranty_type || null,
            warranty.replacement_days,
            warranty.return_days,
            warranty.description || null
          ]
        );
      }

      const shipping = await database.get('SELECT * FROM product_shipping WHERE product_id = ?', [id]);
      if (shipping) {
        await database.run(
          `INSERT INTO product_shipping (product_id, weight, length, width, height, shipping_class, cod_available, free_shipping)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            new_product_id,
            shipping.weight,
            shipping.length,
            shipping.width,
            shipping.height,
            shipping.shipping_class || null,
            shipping.cod_available,
            shipping.free_shipping
          ]
        );
      }

      const variants = await database.all('SELECT * FROM product_variants WHERE product_id = ? AND status <> ?', [id, 'archived']);
      for (const v of variants) {
        const uniqueSku = `SKU-${new_product_id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

        const variantResult = await database.run(
          `INSERT INTO product_variants 
            (product_id, sku, size, color, version, weight, storage, model, barcode, price_override, cost_override, is_default, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            new_product_id,
            uniqueSku,
            v.size || null,
            v.color || 'Default',
            v.version || null,
            v.weight || null,
            v.storage || null,
            v.model || null,
            v.barcode || null,
            v.price_override,
            v.cost_override,
            v.is_default
          ]
        );
        const new_variant_id = variantResult.lastID;

        const inv = await database.get('SELECT * FROM inventory WHERE variant_id = ?', [v.variant_id]);
        if (inv) {
          await database.run(
            `INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price, last_restock_date)
             VALUES (?, ?, 0, 0, ?, ?, NULL)`,
            [
              new_variant_id,
              inv.supplier_id,
              inv.reorder_level,
              inv.purchase_price
            ]
          );
        }
      }

      const media = await database.all('SELECT * FROM product_media WHERE product_id = ?', [id]);
      for (const m of media) {
        await database.run(
          `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
           VALUES (?, NULL, ?, ?, ?, ?, ?)`,
          [
            new_product_id,
            m.media_type,
            m.file_path,
            m.alt_text || null,
            m.position,
            m.is_primary
          ]
        );
      }

      const images = await database.all('SELECT * FROM product_images WHERE product_id = ?', [id]);
      for (const img of images) {
        await database.run(
          `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
           VALUES (?, ?, ?, ?)`,
          [new_product_id, img.image_url, img.is_primary, img.display_order]
        );
      }

      await database.run('COMMIT');
      res.json({ message: 'Product duplicated successfully', product_id: new_product_id });
    } catch (err) {
      await database.run('ROLLBACK');
      console.error('[admin] duplicateProduct:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  // ─── Orders ───────────────────────────────────────────────────────────────

  getAllOrders: async (req, res) => {
    try {
      const orders = await database.all(`
        SELECT o.order_id,
               o.order_number,
               o.customer_name,
               o.customer_email,
               o.total_amount,
               o.status,
               o.payment_method,
               o.payment_status,
               o.placed_at,
               o.updated_at,
               u.user_id,
               u.username
        FROM orders o
        JOIN users u ON o.user_id = u.user_id
        ORDER BY o.placed_at DESC
      `);
      res.json(orders);
    } catch (err) {
      console.error('[admin] getAllOrders:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getOrderById: async (req, res) => {
    const { id } = req.params;
    try {
      const order = await database.get(`
        SELECT o.*, u.username
        FROM orders o
        JOIN users u ON o.user_id = u.user_id
        WHERE o.order_id = ?
      `, [id]);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      const items = await database.all(`
        SELECT oi.order_item_id,
               oi.quantity,
               oi.unit_price,
               oi.line_total,
               p.product_id,
               p.product_name,
               p.image_url,
               pv.sku,
               pv.size,
               pv.color
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        WHERE oi.order_id = ?
      `, [id]);

      const requests = await database.all(`
        SELECT request_id, request_type, status, reason, admin_note, created_at
        FROM order_requests
        WHERE order_id = ?
        ORDER BY created_at DESC
      `, [id]);

      res.json({ ...order, items, requests });
    } catch (err) {
      console.error('[admin] getOrderById:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  updateOrderStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    try {
      await database.run('BEGIN TRANSACTION');
      try {
        const order = await database.get('SELECT user_id, order_number FROM orders WHERE order_id = ?', [id]);
        if (!order) {
          await database.run('ROLLBACK');
          return res.status(404).json({ message: 'Order not found' });
        }

        let query = `UPDATE orders SET status = ?, updated_at = datetime('now')`;
        const params = [status];
        if (status === 'delivered') {
          query += `, delivered_at = datetime('now')`;
        }
        query += ` WHERE order_id = ?`;
        params.push(id);

        const result = await database.run(query, params);
        if (result.changes === 0) {
          await database.run('ROLLBACK');
          return res.status(404).json({ message: 'Order not found' });
        }

        let notifType = null;
        let notifTitle = null;
        let notifMessage = null;

        if (status === 'processing') {
          notifType = 'ORDER_CONFIRMED';
          notifTitle = 'Order Confirmed';
          notifMessage = `Your order ${order.order_number} has been confirmed.`;
        } else if (status === 'shipped') {
          notifType = 'ORDER_SHIPPED';
          notifTitle = 'Order Shipped';
          notifMessage = `Your order ${order.order_number} has been shipped.`;
        } else if (status === 'delivered') {
          notifType = 'ORDER_DELIVERED';
          notifTitle = 'Order Delivered';
          notifMessage = `Your order ${order.order_number} has been delivered.`;
        } else if (status === 'cancelled') {
          notifType = 'ORDER_CANCELLED';
          notifTitle = 'Order Cancelled';
          notifMessage = `Your order ${order.order_number} has been cancelled.`;
        }

        if (notifType) {
          await createNotification(database, {
            user_id: order.user_id,
            type: notifType,
            title: notifTitle,
            message: notifMessage,
            metadata: { order_id: Number(id), order_number: order.order_number },
            event_key: `${notifType}:${id}`
          });
        }

        const allowedEventStatuses = ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
        const eventStatus = status === 'pending' ? 'placed' : status;
        if (allowedEventStatuses.includes(eventStatus)) {
          await database.run(`
            INSERT INTO order_events (order_id, status, message)
            VALUES (?, ?, ?)
          `, [id, eventStatus, `Order status updated to ${status} by admin`]);
        }

        // Payout state machine synchronization (only if supplier_payouts table exists)
        const payoutTableExists = await database.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_payouts'"
        );
        if (payoutTableExists) {
          if (status === 'delivered') {
            await database.run(
              `UPDATE supplier_payouts 
               SET status = 'scheduled', updated_at = datetime('now')
               WHERE order_id = ? AND status = 'pending'`,
              [id]
            );
          } else if (status === 'cancelled' || status === 'returned') {
            await database.run(
              `UPDATE supplier_payouts 
               SET status = 'failed', updated_at = datetime('now')
               WHERE order_id = ? AND status IN ('pending', 'scheduled', 'processing')`,
              [id]
            );
          }
        }

        await database.run('COMMIT');
        res.json({ message: 'Order status updated' });
      } catch (txErr) {
        await database.run('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  // ─── Requests ─────────────────────────────────────────────────────────────

  getAllRequests: async (req, res) => {
    try {
      const requests = await database.all(`
        SELECT r.request_id,
               r.request_type,
               r.reason,
               r.status,
               r.admin_note,
               r.created_at,
               r.resolved_at,
               o.order_id,
               o.order_number,
               u.user_id,
               u.username,
               u.email
        FROM order_requests r
        JOIN orders o ON r.order_id = o.order_id
        JOIN users  u ON r.user_id  = u.user_id
        ORDER BY
          CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,
          r.created_at DESC
      `);
      res.json(requests);
    } catch (err) {
      console.error('[admin] getAllRequests:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  handleRequest: async (req, res) => {
    const { id } = req.params;
    const { status, admin_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }
    try {
      const request = await database.get(
        'SELECT * FROM order_requests WHERE request_id = ?',
        [id]
      );
      if (!request) return res.status(404).json({ message: 'Request not found' });
      if (request.status !== 'pending') {
        return res.status(400).json({ message: 'Request has already been resolved' });
      }

      await database.run('BEGIN TRANSACTION');
      try {
        await database.run(`
          UPDATE order_requests
          SET status = ?, admin_note = ?, updated_at = datetime('now'), resolved_at = datetime('now')
          WHERE request_id = ?
        `, [status, admin_note || null, id]);

        if (status === 'approved') {
          if (request.request_type === 'cancel') {
             await database.run(
               `UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE order_id = ?`,
               [request.order_id]
             );

             // Generate transactional notification
             const order = await database.get('SELECT order_number FROM orders WHERE order_id = ?', [request.order_id]);
             await createNotification(database, {
               user_id: request.user_id,
               type: 'ORDER_CANCELLED',
               title: 'Order Cancelled',
               message: `Your order ${order.order_number} has been cancelled.`,
               metadata: { order_id: request.order_id, order_number: order.order_number },
               event_key: `ORDER_CANCELLED:${request.order_id}`
             });

            // Fetch order items to restock
            const items = await database.all(
              `SELECT variant_id, quantity FROM order_items WHERE order_id = ?`,
              [request.order_id]
            );

            // Increment variant available stock and log movement
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
                [item.variant_id, req.userId || 1, item.quantity, previous_quantity, new_quantity, `Cancellation request approved: ${request.order_id}`]
              );

              // Auto-resolve any active alerts if inventory goes back above reorder_level
              const inv = await database.get(
                `SELECT available_stock, reorder_level FROM inventory WHERE variant_id = ?`,
                [item.variant_id]
              );
              if (inv && inv.available_stock > inv.reorder_level) {
                await database.run(
                   `UPDATE alerts 
                    SET resolved_at = datetime('now'), is_read = 1 
                    WHERE variant_id = ? AND resolved_at IS NULL`,
                  [item.variant_id]
                );
              }
            }
          } else if (request.request_type === 'return') {
            await database.run(
              `UPDATE orders SET status = 'returned', updated_at = datetime('now') WHERE order_id = ?`,
              [request.order_id]
            );

            // Restock items for returned orders
            const items = await database.all(
              `SELECT variant_id, quantity FROM order_items WHERE order_id = ?`,
              [request.order_id]
            );

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
                 VALUES (?, ?, 'RETURN_RESTOCK', ?, ?, ?, ?, datetime('now'))`,
                [item.variant_id, req.userId || 1, item.quantity, previous_quantity, new_quantity, `Return request approved: ${request.order_id}`]
              );

              // Auto-resolve active alerts
              const inv = await database.get(
                `SELECT available_stock, reorder_level FROM inventory WHERE variant_id = ?`,
                [item.variant_id]
              );
              if (inv && inv.available_stock > inv.reorder_level) {
                await database.run(
                  `UPDATE alerts 
                   SET resolved_at = datetime('now'), is_read = 1 
                   WHERE variant_id = ? AND resolved_at IS NULL`,
                  [item.variant_id]
                );
              }
            }
          }
        }

        await database.run('COMMIT');
        res.json({ message: `Request ${status}` });
      } catch (txErr) {
        await database.run('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      console.error('[admin] handleRequest:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  // ─── Customers ────────────────────────────────────────────────────────────

  getAllCustomers: async (req, res) => {
    try {
      const customers = await database.all(`
        SELECT u.user_id,
               u.username,
               u.email,
               u.phone,
               u.status,
               u.created_at,
               COUNT(DISTINCT o.order_id)           AS order_count,
               IFNULL(ROUND(SUM(CASE WHEN o.status NOT IN ('cancelled', 'returned') THEN o.total_amount ELSE 0 END), 2), 0) AS total_spending,
               MAX(o.placed_at)                     AS last_order_date
        FROM users u
        LEFT JOIN orders o ON u.user_id = o.user_id
        WHERE u.role = 'customer'
        GROUP BY u.user_id
        ORDER BY u.created_at DESC
      `);
      res.json(customers);
    } catch (err) {
      console.error('[admin] getAllCustomers:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getCustomerById: async (req, res) => {
    const { id } = req.params;
    try {
      const customer = await database.get(`
        SELECT user_id, username, email, phone, address_line_1, address_line_2, city, state, postal_code, country_code, status, created_at
        FROM users
        WHERE user_id = ? AND role = 'customer'
      `, [id]);

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      const metrics = await database.get(`
        SELECT 
          COUNT(order_id) AS total_orders,
          IFNULL(ROUND(SUM(CASE WHEN status NOT IN ('cancelled', 'returned') THEN total_amount ELSE 0 END), 2), 0) AS total_spending,
          IFNULL(ROUND(AVG(CASE WHEN status NOT IN ('cancelled', 'returned') THEN total_amount ELSE NULL END), 2), 0) AS average_order_value,
          IFNULL(SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END), 0) AS return_count
        FROM orders
        WHERE user_id = ?
      `, [id]);

      const orders = await database.all(`
        SELECT order_id, order_number, total_amount, status, placed_at
        FROM orders
        WHERE user_id = ?
        ORDER BY placed_at DESC
      `, [id]);

      for (const order of orders) {
        order.items = await database.all(`
          SELECT oi.quantity, oi.unit_price, oi.line_total, p.product_name, pv.sku, pv.size, pv.color
          FROM order_items oi
          JOIN product_variants pv ON oi.variant_id = pv.variant_id
          JOIN products p ON pv.product_id = p.product_id
          WHERE oi.order_id = ?
        `, [order.order_id]);
      }

      res.json({
        customer,
        metrics,
        orders,
      });
    } catch (err) {
      console.error('[admin] getCustomerById:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  setCustomerStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;  // 'active' or 'blocked'
    if (!['active', 'blocked'].includes(status)) {
      return res.status(400).json({ message: 'Status must be active or blocked' });
    }
    // 'blocked' → stored as 'inactive' in DB (schema allows: active | inactive | suspended)
    const dbStatus = status === 'blocked' ? 'inactive' : 'active';
    try {
      const result = await database.run(
        `UPDATE users SET status = ?, updated_at = datetime('now')
         WHERE user_id = ? AND role = 'customer'`,
        [dbStatus, id]
      );
      if (result.changes === 0) return res.status(404).json({ message: 'Customer not found' });
      res.json({ message: `Customer ${status === 'blocked' ? 'blocked' : 'activated'}` });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  // ─── Reviews ──────────────────────────────────────────────────────────────

  getAllReviews: async (req, res) => {
    try {
      const reviews = await database.all(`
        SELECT r.review_id,
               r.rating,
               r.title,
               r.comment,
               r.is_verified_purchase,
               r.status,
               r.created_at,
               p.product_id,
               p.product_name,
               u.user_id,
               u.username
        FROM reviews r
        JOIN products p ON r.product_id = p.product_id
        JOIN users    u ON r.user_id    = u.user_id
        ORDER BY r.created_at DESC
      `);

      const enriched = await Promise.all(
        reviews.map(async (r) => {
          const images = await database.all(
            `SELECT image_id, image_url FROM review_images WHERE review_id = ? ORDER BY created_at ASC`,
            [r.review_id]
          );
          return {
            ...r,
            verified_purchase: !!r.is_verified_purchase,
            images
          };
        })
      );

      res.json(enriched);
    } catch (err) {
      console.error('[admin] getAllReviews:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  deleteReview: async (req, res) => {
    return res.status(403).json({ message: 'Admin review deletion is forbidden. Use moderation visibility toggles.' });
  },

  updateReviewStatus: async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    const adminId = req.userId;

    if (!status || !['approved', 'hidden'].includes(status)) {
      return res.status(400).json({ message: 'Invalid or missing status' });
    }

    try {
      const review = await database.get('SELECT * FROM reviews WHERE review_id = ?', [id]);
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      await database.run('BEGIN TRANSACTION');

      try {
        await database.run(
          `UPDATE reviews SET status = ?, updated_at = datetime('now') WHERE review_id = ?`,
          [status, id]
        );

        await database.run(
          `INSERT INTO review_moderation_logs (review_id, previous_status, new_status, actor_user_id, notes)
           VALUES (?, ?, ?, ?, ?)`,
          [id, review.status, status, adminId, notes || `Status updated to ${status}`]
        );

        const product = await database.get('SELECT product_name FROM products WHERE product_id = ?', [review.product_id]);
        const productName = product ? product.product_name : 'your product';

        let notifType = null;
        let notifTitle = null;
        let notifMessage = null;

        if (status === 'hidden' && review.status !== 'hidden') {
          notifType = 'REVIEW_HIDDEN';
          notifTitle = 'Review Hidden';
          notifMessage = `Your review for ${productName} has been hidden due to moderation guidelines.`;
        } else if (status === 'approved' && review.status === 'hidden') {
          notifType = 'REVIEW_RESTORED';
          notifTitle = 'Review Restored';
          notifMessage = `Your review for ${productName} has been restored.`;
        }

        if (notifType) {
          await createNotification(database, {
            user_id: review.user_id,
            type: notifType,
            title: notifTitle,
            message: notifMessage,
            metadata: { review_id: Number(id), product_id: review.product_id },
            event_key: `${notifType}:${id}`
          });
        }

        await database.run('COMMIT');
        res.json({ message: `Review status updated to ${status} successfully` });
      } catch (err) {
        await database.run('ROLLBACK');
        throw err;
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getInventoryValue: async (req, res) => {
    try {
      const stats = await database.get(`
        SELECT 
          COUNT(DISTINCT i.variant_id) AS total_skus,
          SUM(i.available_stock) AS total_physical_items,
          ROUND(SUM(i.available_stock * i.purchase_price), 2) AS total_cost_value,
          ROUND(SUM(i.available_stock * COALESCE(pv.price_override, p.selling_price)), 2) AS total_retail_value,
          ROUND(SUM(i.available_stock * (COALESCE(pv.price_override, p.selling_price) - i.purchase_price)), 2) AS potential_gross_profit
        FROM inventory i
        JOIN product_variants pv ON i.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        WHERE pv.status <> 'archived' AND p.product_status <> 'archived'
      `);
      
      const margin_percent = stats.total_retail_value > 0 
        ? Math.round((stats.potential_gross_profit / stats.total_retail_value) * 10000) / 100 
        : 0;

      res.json({
        total_skus: stats.total_skus || 0,
        total_physical_items: stats.total_physical_items || 0,
        total_cost_value: stats.total_cost_value || 0,
        total_retail_value: stats.total_retail_value || 0,
        potential_gross_profit: stats.potential_gross_profit || 0,
        margin_percent
      });
    } catch (err) {
      console.error('[admin] getInventoryValue:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getInventoryHistory: async (req, res) => {
    const limit = Number(req.query.limit) || 50;
    try {
      const history = await database.all(`
        SELECT 
          im.movement_id,
          im.variant_id,
          im.change,
          im.reason,
          im.created_by,
          im.created_at,
          pv.sku,
          p.product_name
        FROM inventory_movements im
        JOIN product_variants pv ON im.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        ORDER BY im.created_at DESC
        LIMIT ?
      `, [limit]);
      res.json(history);
    } catch (err) {
      console.error('[admin] getInventoryHistory:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getAlerts: async (req, res) => {
    try {
      const alerts = await database.all(`
        SELECT 
          a.alert_id,
          a.type,
          a.severity,
          a.product_id,
          a.variant_id,
          a.message,
          a.is_read,
          a.created_at,
          p.product_name,
          pv.sku
        FROM alerts a
        LEFT JOIN products p ON a.product_id = p.product_id
        LEFT JOIN product_variants pv ON a.variant_id = pv.variant_id
        WHERE a.resolved_at IS NULL
        ORDER BY 
          CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
          a.created_at DESC
      `);
      res.json(alerts);
    } catch (err) {
      console.error('[admin] getAlerts:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getInventory: async (req, res) => {
    try {
      const inventoryList = await database.all(`
        SELECT 
          pv.variant_id,
          pv.product_id,
          pv.sku,
          pv.size,
          pv.color,
          pv.price_override,
          pv.cost_override,
          pv.is_default,
          pv.status AS variant_status,
          p.product_name,
          p.selling_price AS base_selling_price,
          p.cost_price AS base_cost_price,
          c.category_name,
          i.inventory_id,
          i.available_stock,
          i.reserved_stock,
          i.reorder_level,
          i.purchase_price,
          i.last_restock_date,
          s.supplier_name,
          s.supplier_id
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN inventory i ON pv.variant_id = i.variant_id
        LEFT JOIN suppliers s ON i.supplier_id = s.supplier_id
        WHERE pv.status <> 'archived' AND p.product_status <> 'archived'
        ORDER BY p.product_name ASC, pv.is_default DESC, pv.sku ASC
      `);
      res.json(inventoryList);
    } catch (err) {
      console.error('[admin] getInventory:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  adjustInventory: async (req, res) => {
    const { variant_id, movement_type, quantity, notes } = req.body;
    
    if (!variant_id || !movement_type || quantity === undefined) {
      return res.status(400).json({ message: 'variant_id, movement_type, and quantity are required' });
    }

    const ALLOWED_MANUAL_TYPES = [
      'SUPPLIER_RESTOCK',
      'DAMAGED',
      'MANUAL_CORRECTION',
      'INTERNAL_USAGE'
    ];

    if (!ALLOWED_MANUAL_TYPES.includes(movement_type)) {
      return res.status(400).json({ message: 'Invalid movement type for manual adjustment' });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Quantity must be a positive integer' });
    }

    try {
      const result = await inventoryService.adjustInventory(database, {
        variant_id,
        actor_user_id: req.userId || 1,
        movement_type,
        quantity: qty,
        notes: notes || ''
      });

      // Handle low stock / out of stock alerts
      const inv = await database.get('SELECT * FROM inventory WHERE variant_id = ?', [variant_id]);
      const newStock = inv.available_stock;
      const reorderLevel = inv.reorder_level;

      if (newStock <= reorderLevel) {
        const type = newStock === 0 ? 'out_of_stock' : 'low_stock';
        const severity = newStock === 0 ? 'critical' : 'warning';
        const pv = await database.get('SELECT product_id, sku FROM product_variants WHERE variant_id = ?', [variant_id]);
        
        await database.run(`
          INSERT INTO alerts (type, severity, product_id, variant_id, message)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(type, variant_id) DO UPDATE SET
            severity = EXCLUDED.severity,
            message = EXCLUDED.message,
            is_read = 0,
            created_at = datetime('now'),
            resolved_at = NULL
          WHERE resolved_at IS NOT NULL
        `, [type, severity, pv.product_id, variant_id, `Low stock for SKU ${pv.sku}. Available: ${newStock}`]);
      } else {
        await database.run(`
          UPDATE alerts 
          SET resolved_at = datetime('now'), is_read = 1 
          WHERE variant_id = ? AND resolved_at IS NULL
        `, [variant_id]);
      }

      res.json({ message: 'Inventory adjusted successfully', newStock });
    } catch (err) {
      console.error('[admin] adjustInventory error:', err.message);
      res.status(400).json({ message: err.message });
    }
  },

  getInventoryHistoryByVariant: async (req, res) => {
    const { variant_id } = req.params;
    if (!variant_id) {
      return res.status(400).json({ message: 'variant_id is required' });
    }
    try {
      const history = await inventoryService.getInventoryHistory(database, variant_id);
      res.json(history);
    } catch (err) {
      console.error('[admin] getInventoryHistoryByVariant:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  resolveAlert: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await database.run(
        `UPDATE alerts SET resolved_at = datetime('now'), is_read = 1 WHERE alert_id = ?`,
        [id]
      );
      if (result.changes === 0) return res.status(404).json({ message: 'Alert not found or already resolved' });
      res.json({ message: 'Alert marked as resolved' });
    } catch (err) {
      console.error('[admin] resolveAlert:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getSupplierPerformance: async (req, res) => {
    try {
      const performance = await database.all(`
        SELECT 
          u.user_id AS supplier_id,
          u.username AS supplier_name,
          
          -- PO counts
          (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = u.user_id) AS total_purchase_orders,
          (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = u.user_id AND status = 'RECEIVED') AS completed_purchase_orders,
          (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = u.user_id AND status = 'CANCELLED') AS cancelled_purchase_orders,
          (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = u.user_id AND status IN ('SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED')) AS active_purchase_orders,
          
          -- Item quantities
          (SELECT IFNULL(SUM(poi.ordered_quantity), 0) 
           FROM purchase_order_items poi 
           JOIN purchase_orders po ON poi.po_id = po.po_id 
           WHERE po.supplier_id = u.user_id) AS quantity_ordered,
           
          (SELECT IFNULL(SUM(poi.received_quantity), 0) 
           FROM purchase_order_items poi 
           JOIN purchase_orders po ON poi.po_id = po.po_id 
           WHERE po.supplier_id = u.user_id) AS quantity_received,
           
          -- Averages
          (SELECT AVG((julianday(acknowledged_at) - julianday(sent_at)) * 24) 
           FROM purchase_orders 
           WHERE supplier_id = u.user_id AND sent_at IS NOT NULL AND acknowledged_at IS NOT NULL) AS average_ack_hours,
           
          (SELECT AVG(julianday(received_at) - julianday(sent_at)) 
           FROM purchase_orders 
           WHERE supplier_id = u.user_id AND sent_at IS NOT NULL AND received_at IS NOT NULL) AS average_delivery_days

        FROM users u
        WHERE u.role = 'supplier'
      `);

      // Calculate rates in JS to prevent division-by-zero
      const formatted = performance.map(row => {
        const total = row.total_purchase_orders;
        const completed = row.completed_purchase_orders;
        const ordered = row.quantity_ordered;
        const received = row.quantity_received;

        return {
          supplier_id: row.supplier_id,
          supplier_name: row.supplier_name,
          total_purchase_orders: total,
          completed_purchase_orders: completed,
          cancelled_purchase_orders: row.cancelled_purchase_orders,
          active_purchase_orders: row.active_purchase_orders,
          fulfillment_rate: total > 0 ? Number((completed / total).toFixed(4)) : 0,
          quantity_ordered: ordered,
          quantity_received: received,
          fill_rate: ordered > 0 ? Number((received / ordered).toFixed(4)) : 0,
          average_ack_hours: row.average_ack_hours !== null ? Number(row.average_ack_hours.toFixed(2)) : null,
          average_delivery_days: row.average_delivery_days !== null ? Number(row.average_delivery_days.toFixed(2)) : null
        };
      });

      res.json(formatted);
    } catch (err) {
      console.error('[admin] getSupplierPerformance error:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getInventoryForecast: async (req, res) => {
    try {
      const forecast = await database.all(`
        SELECT 
          pv.variant_id,
          pv.sku,
          p.product_name,
          pv.size,
          pv.color,
          IFNULL(i.available_stock, 0) AS current_stock,
          
          -- sales_last_7_days
          (SELECT IFNULL(SUM(oi.quantity), 0)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.order_id
           WHERE oi.variant_id = pv.variant_id
             AND o.status = 'delivered'
             AND o.placed_at >= datetime('now', '-7 days')) AS sales_last_7_days,
             
          -- sales_last_30_days
          (SELECT IFNULL(SUM(oi.quantity), 0)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.order_id
           WHERE oi.variant_id = pv.variant_id
             AND o.status = 'delivered'
             AND o.placed_at >= datetime('now', '-30 days')) AS sales_last_30_days,
             
          -- sales_last_90_days
          (SELECT IFNULL(SUM(oi.quantity), 0)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.order_id
           WHERE oi.variant_id = pv.variant_id
             AND o.status = 'delivered'
             AND o.placed_at >= datetime('now', '-90 days')) AS sales_last_90_days

        FROM product_variants pv
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN inventory i ON pv.variant_id = i.variant_id
        WHERE p.product_status <> 'archived'
      `);

      const formatted = forecast.map(row => {
        const sales30d = row.sales_last_30_days;
        const average_daily_sales_30d = Number((sales30d / 30.0).toFixed(4));
        const current_stock = row.current_stock;
        let days_of_inventory = null;
        let risk_bucket = 'HEALTHY';

        if (average_daily_sales_30d === 0) {
          days_of_inventory = null;
          risk_bucket = 'NO_SALES_HISTORY';
        } else {
          days_of_inventory = Number((current_stock / average_daily_sales_30d).toFixed(2));
          if (days_of_inventory < 7) {
            risk_bucket = 'CRITICAL';
          } else if (days_of_inventory < 21) {
            risk_bucket = 'LOW';
          } else if (days_of_inventory > 90) {
            risk_bucket = 'OVERSTOCKED';
          } else {
            risk_bucket = 'HEALTHY';
          }
        }

        return {
          variant_id: row.variant_id,
          sku: row.sku,
          product_name: row.product_name,
          size: row.size,
          color: row.color,
          current_stock,
          sales_last_7_days: row.sales_last_7_days,
          sales_last_30_days: row.sales_last_30_days,
          sales_last_90_days: row.sales_last_90_days,
          average_daily_sales_30d,
          days_of_inventory,
          risk_bucket
        };
      });

      res.json(formatted);
    } catch (err) {
      console.error('[admin] getInventoryForecast error:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getOperationsMetrics: async (req, res) => {
    try {
      const metrics = await database.all(`
        SELECT 
          pv.variant_id,
          pv.sku,
          p.product_name,
          pv.size,
          pv.color,
          IFNULL(i.available_stock, 0) AS current_stock,
          
          -- units_sold_90d
          (SELECT IFNULL(SUM(oi.quantity), 0)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.order_id
           WHERE oi.variant_id = pv.variant_id
             AND o.status = 'delivered'
             AND o.placed_at >= datetime('now', '-90 days')) AS units_sold_90d,
             
          -- net_change_90d (sum of quantity_change in inventory_movements in last 90 days)
          (SELECT IFNULL(SUM(im.quantity_change), 0)
           FROM inventory_movements im
           WHERE im.variant_id = pv.variant_id
             AND im.created_at >= datetime('now', '-90 days')) AS net_change_90d,
             
          -- returned_units (all time returned units)
          (SELECT IFNULL(SUM(oi.quantity), 0)
           FROM returns ret
           JOIN order_items oi ON ret.order_item_id = oi.order_item_id
           WHERE ret.variant_id = pv.variant_id) AS returned_units,
           
          -- sold_units (all time sold units)
          (SELECT IFNULL(SUM(oi.quantity), 0)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.order_id
           WHERE oi.variant_id = pv.variant_id
             AND o.status = 'delivered') AS sold_units

        FROM product_variants pv
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN inventory i ON pv.variant_id = i.variant_id
        WHERE p.product_status <> 'archived'
      `);

      const formatted = metrics.map(row => {
        const current_stock = row.current_stock;
        const units_sold_90d = row.units_sold_90d;
        
        // Reconstruct stock level 90 days ago
        const reconstructed_stock_90d = current_stock - row.net_change_90d;
        
        // Average inventory over 90 days
        const average_inventory_90d = (current_stock + reconstructed_stock_90d) / 2.0;
        
        // Calculations
        let inventory_turnover = 0;
        if (average_inventory_90d > 0) {
          inventory_turnover = Number((units_sold_90d / average_inventory_90d).toFixed(4));
        }

        const sold_units = row.sold_units;
        const returned_units = row.returned_units;
        const return_rate = sold_units > 0 ? Number((returned_units / sold_units).toFixed(4)) : 0;

        const sell_through_rate = (sold_units + current_stock) > 0 
          ? Number((sold_units / (sold_units + current_stock)).toFixed(4)) 
          : 0;

        // Flags
        const flags = [];
        if (return_rate > 0.20) {
          flags.push('HIGH_RETURN_RATE');
        }
        if (inventory_turnover < 0.25) {
          flags.push('SLOW_MOVING');
        }
        if (inventory_turnover > 2.0) {
          flags.push('FAST_MOVING');
        }

        return {
          variant_id: row.variant_id,
          sku: row.sku,
          product_name: row.product_name,
          size: row.size,
          color: row.color,
          current_stock,
          units_sold_90d,
          average_inventory_90d,
          inventory_turnover,
          return_rate,
          sell_through_rate,
          flags
        };
      });

      res.json(formatted);
    } catch (err) {
      console.error('[admin] getOperationsMetrics error:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getSalesAnalytics: async (req, res) => {
    try {
      const salesQuery = `
        SELECT DATE(placed_at) AS date,
               ROUND(SUM(total_amount), 2) AS revenue,
               ROUND(SUM(discount_amount), 2) AS discount,
               COUNT(order_id) AS orders
        FROM orders
        WHERE status != 'cancelled'
        GROUP BY DATE(placed_at)
        ORDER BY date ASC
      `;
      const dailySales = await database.all(salesQuery);

      const catQuery = `
        SELECT c.category_name,
               ROUND(SUM(oi.line_total), 2) AS revenue,
               SUM(oi.quantity) AS quantity
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        JOIN categories c ON p.category_id = c.category_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status != 'cancelled'
        GROUP BY c.category_id
        ORDER BY revenue DESC
      `;
      const categories = await database.all(catQuery);

      const prodQuery = `
        SELECT p.product_id, p.product_name,
               ROUND(SUM(oi.line_total), 2) AS revenue,
               SUM(oi.quantity) AS quantity,
               ROUND(SUM(oi.quantity * p.cost_price), 2) AS cogs
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status != 'cancelled'
        GROUP BY p.product_id
        ORDER BY revenue DESC
        LIMIT 10
      `;
      const products = await database.all(prodQuery);

      const supplierQuery = `
        SELECT u.username AS supplier_name,
               ROUND(SUM(oi.line_total), 2) AS revenue,
               SUM(oi.quantity) AS quantity,
               ROUND(SUM(oi.quantity * p.cost_price), 2) AS cogs
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        JOIN users u ON p.supplier_id = u.user_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status != 'cancelled'
        GROUP BY p.supplier_id
        ORDER BY revenue DESC
      `;
      const suppliers = await database.all(supplierQuery);

      const overall = await database.get(`
        SELECT COUNT(order_id) AS total_orders,
               ROUND(SUM(total_amount), 2) AS total_revenue,
               ROUND(SUM(discount_amount), 2) AS total_discount,
               COUNT(DISTINCT user_id) AS unique_customers
        FROM orders
        WHERE status != 'cancelled'
      `);

      const cogsOverall = await database.get(`
        SELECT ROUND(SUM(oi.quantity * p.cost_price), 2) AS total_cogs
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status != 'cancelled'
      `);

      const totalRevenue = overall.total_revenue || 0;
      const totalCogs = cogsOverall.total_cogs || 0;
      const grossProfit = totalRevenue - totalCogs;
      const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const aov = overall.total_orders > 0 ? totalRevenue / overall.total_orders : 0;
      const revenuePerCustomer = overall.unique_customers > 0 ? totalRevenue / overall.unique_customers : 0;

      const thisMonth = await database.get(`
        SELECT SUM(total_amount) AS rev FROM orders
        WHERE status != 'cancelled' AND placed_at >= datetime('now', 'start of month')
      `);
      const lastMonth = await database.get(`
        SELECT SUM(total_amount) AS rev FROM orders
        WHERE status != 'cancelled'
          AND placed_at >= datetime('now', 'start of month', '-1 month')
          AND placed_at < datetime('now', 'start of month')
      `);
      const currentMonthRev = thisMonth.rev || 0;
      const lastMonthRev = lastMonth.rev || 0;
      const growthPct = lastMonthRev > 0 ? ((currentMonthRev - lastMonthRev) / lastMonthRev) * 100 : 0;

      res.json({
        dailySales,
        categories,
        products: products.map(p => ({
          ...p,
          gross_profit: p.revenue - p.cogs,
          gross_margin_pct: p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0
        })),
        suppliers: suppliers.map(s => ({
          ...s,
          gross_profit: s.revenue - s.cogs,
          gross_margin_pct: s.revenue > 0 ? ((s.revenue - s.cogs) / s.revenue) * 100 : 0
        })),
        summary: {
          total_revenue: totalRevenue,
          total_discount: overall.total_discount || 0,
          total_orders: overall.total_orders || 0,
          unique_customers: overall.unique_customers || 0,
          total_cogs: totalCogs,
          gross_profit: grossProfit,
          gross_margin_pct: grossMarginPct,
          aov,
          revenue_per_customer: revenuePerCustomer,
          month_growth_pct: growthPct
        }
      });
    } catch (err) {
      console.error('[admin] getSalesAnalytics:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getOrderAnalytics: async (req, res) => {
    try {
      const counts = await database.all(`
        SELECT status, COUNT(*) AS count
        FROM orders
        GROUP BY status
      `);

      const statusCounts = {
        pending: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        returned: 0
      };
      counts.forEach(row => {
        if (statusCounts[row.status] !== undefined) {
          statusCounts[row.status] = row.count;
        }
      });

      const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
      const successRate = total > 0 ? (statusCounts.delivered / total) * 100 : 0;
      const cancellationRate = total > 0 ? (statusCounts.cancelled / total) * 100 : 0;
      const refundRate = total > 0 ? (statusCounts.returned / total) * 100 : 0;

      const processingTime = await database.get(`
        SELECT AVG(julianday(oe2.created_at) - julianday(oe1.created_at)) * 24 AS avg_hours
        FROM order_events oe1
        JOIN order_events oe2 ON oe1.order_id = oe2.order_id
        WHERE oe1.status = 'placed' AND oe2.status = 'processing'
      `);

      const deliveryTime = await database.get(`
        SELECT AVG(julianday(delivered_at) - julianday(placed_at)) AS avg_days
        FROM orders
        WHERE status = 'delivered' AND delivered_at IS NOT NULL AND placed_at IS NOT NULL
      `);

      const orderTrends = await database.all(`
        SELECT DATE(placed_at) AS date,
               COUNT(*) AS total_orders,
               SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS completed_orders,
               SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders
        FROM orders
        GROUP BY DATE(placed_at)
        ORDER BY date ASC
      `);

      res.json({
        statusCounts,
        summary: {
          total_orders: total,
          success_rate: successRate,
          cancellation_rate: cancellationRate,
          refund_rate: refundRate,
          avg_processing_hours: processingTime.avg_hours || 0,
          avg_delivery_days: deliveryTime.avg_days || 0
        },
        orderTrends
      });
    } catch (err) {
      console.error('[admin] getOrderAnalytics:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getCustomerAnalytics: async (req, res) => {
    try {
      const totalCustomersRes = await database.get(`
        SELECT COUNT(*) AS count FROM users WHERE role = 'customer'
      `);
      const totalCustomers = totalCustomersRes.count || 0;

      const newCustomersRes = await database.get(`
        SELECT COUNT(*) AS count FROM users
        WHERE role = 'customer' AND created_at >= datetime('now', '-30 days')
      `);
      const newCustomers = newCustomersRes.count || 0;

      const repeatCustomersRes = await database.get(`
        SELECT COUNT(*) AS count FROM (
          SELECT user_id FROM orders
          WHERE status != 'cancelled'
          GROUP BY user_id
          HAVING COUNT(order_id) > 1
        )
      `);
      const repeatCustomers = repeatCustomersRes.count || 0;
      const repeatPurchaseRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

      const retentionRes = await database.get(`
        WITH first_orders AS (
          SELECT user_id, MIN(placed_at) AS first_placed_at
          FROM orders
          WHERE status != 'cancelled'
          GROUP BY user_id
        ),
        subsequent_orders AS (
          SELECT o.user_id, o.placed_at, f.first_placed_at
          FROM orders o
          JOIN first_orders f ON o.user_id = f.user_id
          WHERE o.status != 'cancelled' AND o.placed_at > f.first_placed_at
        )
        SELECT
          COUNT(DISTINCT user_id) AS cohort_size,
          COUNT(DISTINCT CASE WHEN diff_days <= 30 THEN user_id END) AS retained_30,
          COUNT(DISTINCT CASE WHEN diff_days <= 60 THEN user_id END) AS retained_60,
          COUNT(DISTINCT CASE WHEN diff_days <= 90 THEN user_id END) AS retained_90
        FROM (
          SELECT f.user_id,
                 MIN(julianday(s.placed_at) - julianday(f.first_placed_at)) AS diff_days
          FROM first_orders f
          LEFT JOIN subsequent_orders s ON f.user_id = s.user_id
          GROUP BY f.user_id
        )
      `);

      const cohortSize = retentionRes.cohort_size || 1;
      const retentionRate30 = (retentionRes.retained_30 / cohortSize) * 100;
      const retentionRate60 = (retentionRes.retained_60 / cohortSize) * 100;
      const retentionRate90 = (retentionRes.retained_90 / cohortSize) * 100;

      const spendersQuery = `
        SELECT u.user_id, u.username, u.email,
               ROUND(SUM(o.total_amount), 2) AS total_spend,
               COUNT(o.order_id) AS order_count
        FROM users u
        JOIN orders o ON u.user_id = o.user_id
        WHERE o.status != 'cancelled'
        GROUP BY u.user_id
        ORDER BY total_spend DESC
      `;
      const allSpenders = await database.all(spendersQuery);

      const totalSpendersCount = allSpenders.length;
      const highValueLimit = Math.max(1, Math.ceil(totalSpendersCount * 0.1));
      
      const segments = {
        high_value: 0,
        repeat: 0,
        one_time: 0
      };

      allSpenders.forEach((cust, idx) => {
        if (idx < highValueLimit) {
          segments.high_value++;
        } else if (cust.order_count > 1) {
          segments.repeat++;
        } else {
          segments.one_time++;
        }
      });

      const clvRes = await database.get(`
        SELECT AVG(user_total_spend) AS clv
        FROM (
          SELECT SUM(total_amount) AS user_total_spend
          FROM orders
          WHERE status != 'cancelled'
          GROUP BY user_id
        )
      `);
      
      const freqRes = await database.get(`
        SELECT AVG(user_orders) AS freq
        FROM (
          SELECT COUNT(order_id) AS user_orders
          FROM orders
          WHERE status != 'cancelled'
          GROUP BY user_id
        )
      `);

      res.json({
        summary: {
          total_customers: totalCustomers,
          new_customers: newCustomers,
          returning_customers: repeatCustomers,
          repeat_purchase_rate: repeatPurchaseRate,
          clv: clvRes.clv || 0,
          purchase_frequency: freqRes.freq || 0,
          retention_30: retentionRate30,
          retention_60: retentionRate60,
          retention_90: retentionRate90
        },
        segments,
        topSpenders: allSpenders.slice(0, 10)
      });
    } catch (err) {
      console.error('[admin] getCustomerAnalytics:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getProductAnalytics: async (req, res) => {
    try {
      const views = await database.all(`
        SELECT product_id, COUNT(*) AS view_count
        FROM analytics_events
        WHERE event_name = 'product_view' AND product_id IS NOT NULL
        GROUP BY product_id
      `);
      const viewsMap = {};
      views.forEach(v => { viewsMap[v.product_id] = v.view_count; });

      const carts = await database.all(`
        SELECT product_id, COUNT(*) AS cart_count
        FROM analytics_events
        WHERE event_name = 'add_to_cart' AND product_id IS NOT NULL
        GROUP BY product_id
      `);
      const cartsMap = {};
      carts.forEach(c => { cartsMap[c.product_id] = c.cart_count; });

      const wishlists = await database.all(`
        SELECT product_id, COUNT(*) AS wishlist_count
        FROM analytics_events
        WHERE event_name = 'wishlist_add' AND product_id IS NOT NULL
        GROUP BY product_id
      `);
      const wishlistsMap = {};
      wishlists.forEach(w => { wishlistsMap[w.product_id] = w.wishlist_count; });

      const wishlistConversions = await database.all(`
        SELECT w.product_id, COUNT(DISTINCT w.user_id) AS wishlist_users, COUNT(DISTINCT p.user_id) AS purchased_users
        FROM analytics_events w
        LEFT JOIN analytics_events p ON w.user_id = p.user_id AND w.product_id = p.product_id AND p.event_name = 'purchase_complete'
        WHERE w.event_name = 'wishlist_add' AND w.product_id IS NOT NULL
        GROUP BY w.product_id
      `);
      const wishConvMap = {};
      wishlistConversions.forEach(row => {
        wishConvMap[row.product_id] = row.wishlist_users > 0 ? (row.purchased_users / row.wishlist_users) * 100 : 0;
      });

      const productPerformance = await database.all(`
        SELECT p.product_id, p.product_name, p.selling_price, p.cost_price,
               ROUND(SUM(CASE WHEN o.order_id IS NOT NULL THEN oi.line_total ELSE 0 END), 2) AS revenue,
               SUM(CASE WHEN o.order_id IS NOT NULL THEN oi.quantity ELSE 0 END) AS units_sold,
               COUNT(DISTINCT o.order_id) AS orders_count
        FROM products p
        LEFT JOIN product_variants pv ON p.product_id = pv.product_id
        LEFT JOIN order_items oi ON pv.variant_id = oi.variant_id
        LEFT JOIN orders o ON oi.order_id = o.order_id AND o.status != 'cancelled'
        GROUP BY p.product_id
        ORDER BY revenue DESC
      `);

      const turnoverForecast = await database.all(`
        SELECT p.product_id, SUM(i.available_stock) AS current_stock
        FROM products p
        LEFT JOIN product_variants pv ON p.product_id = pv.product_id
        LEFT JOIN inventory i ON pv.variant_id = i.variant_id
        GROUP BY p.product_id
      `);
      const stockMap = {};
      turnoverForecast.forEach(t => { stockMap[t.product_id] = t.current_stock || 0; });

      const productsList = productPerformance.map(prod => {
        const pId = prod.product_id;
        const viewCount = viewsMap[pId] || 0;
        const cartCount = cartsMap[pId] || 0;
        const wishlistCount = wishlistsMap[pId] || 0;
        const wishlistConvRate = wishConvMap[pId] || 0;
        
        const selling = prod.selling_price || 0;
        const cost = prod.cost_price || 0;
        const margin = selling > 0 ? ((selling - cost) / selling) * 100 : 0;

        const convRate = viewCount > 0 ? (prod.units_sold / viewCount) * 100 : 0;
        const addCartRate = viewCount > 0 ? (cartCount / viewCount) * 100 : 0;
        const cartAbandonmentRate = cartCount > 0 ? ((cartCount - (prod.units_sold || 0)) / cartCount) * 100 : 0;

        const currentStock = stockMap[pId] || 0;
        const turnover = (currentStock + (prod.units_sold || 0)) > 0
          ? (prod.units_sold || 0) / (((currentStock + (prod.units_sold || 0)) + currentStock) / 2)
          : 0;

        return {
          product_id: pId,
          product_name: prod.product_name,
          revenue: prod.revenue || 0,
          units_sold: prod.units_sold || 0,
          margin,
          view_count: viewCount,
          conversion_rate: convRate,
          add_to_cart_rate: addCartRate,
          cart_abandonment_rate: Math.max(0, cartAbandonmentRate),
          wishlist_count: wishlistCount,
          wishlist_conversion_rate: wishlistConvRate,
          inventory_turnover: turnover
        };
      });

      res.json({
        products: productsList
      });
    } catch (err) {
      console.error('[admin] getProductAnalytics:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getFunnelAnalytics: async (req, res) => {
    try {
      const viewSession = await database.get(`
        SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE event_name = 'product_view'
      `);
      const clickSession = await database.get(`
        SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE event_name = 'product_click'
      `);
      const wishlistSession = await database.get(`
        SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE event_name = 'wishlist_add'
      `);
      const cartSession = await database.get(`
        SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE event_name = 'add_to_cart'
      `);
      const checkoutSession = await database.get(`
        SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE event_name = 'checkout_started'
      `);
      const checkoutCompSession = await database.get(`
        SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE event_name = 'checkout_completed'
      `);
      const purchaseSession = await database.get(`
        SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE event_name = 'purchase_complete'
      `);

      const steps = [
        { name: 'Product Viewed', count: viewSession.count || 0 },
        { name: 'Product Clicked', count: clickSession.count || 0 },
        { name: 'Added to Wishlist', count: wishlistSession.count || 0 },
        { name: 'Added to Cart', count: cartSession.count || 0 },
        { name: 'Checkout Started', count: checkoutSession.count || 0 },
        { name: 'Checkout Completed', count: checkoutCompSession.count || 0 },
        { name: 'Purchase Completed', count: purchaseSession.count || 0 }
      ];

      const baseline = steps[0].count || 1;
      const formattedSteps = steps.map((step, idx) => {
        const prevCount = idx > 0 ? steps[idx - 1].count : step.count;
        return {
          step: step.name,
          sessions: step.count,
          overall_conversion_pct: (step.count / baseline) * 100,
          step_conversion_pct: prevCount > 0 ? (step.count / prevCount) * 100 : 0,
          abandonment_pct: prevCount > 0 ? ((prevCount - step.count) / prevCount) * 100 : 0
        };
      });

      res.json({
        funnel: formattedSteps
      });
    } catch (err) {
      console.error('[admin] getFunnelAnalytics:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getOperationalMetrics: async (req, res) => {
    try {
      const responseStats = await database.get(`
        SELECT AVG(duration_ms) AS avg_duration, COUNT(*) AS count
        FROM api_metrics
      `);
      const slowestEndpoints = await database.all(`
        SELECT method, path, AVG(duration_ms) AS avg_duration, MAX(duration_ms) AS max_duration, COUNT(*) AS hits
        FROM api_metrics
        GROUP BY method, path
        ORDER BY avg_duration DESC
        LIMIT 10
      `);

      const errorStats = await database.get(`
        SELECT
          COUNT(*) AS total_hits,
          SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS error_hits
        FROM api_metrics
      `);
      const totalHits = errorStats.total_hits || 0;
      const errorRate = totalHits > 0 ? (errorStats.error_hits / totalHits) * 100 : 0;

      const failedPayments = await database.all(`
        SELECT created_at, metadata
        FROM analytics_events
        WHERE event_name = 'payment_failed'
        ORDER BY created_at DESC
        LIMIT 20
      `);

      const searchSessions = await database.get(`
        SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE event_name = 'search_used'
      `);
      const totalSessionsRes = await database.get(`
        SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events
      `);
      const totalSessions = totalSessionsRes.count || 1;
      const searchUsageRate = (searchSessions.count / totalSessions) * 100;

      const recClicks = await database.get(`
        SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE event_name = 'recommendation_click'
      `);
      const prodViews = await database.get(`
        SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE event_name = 'product_view'
      `);
      const recCTR = prodViews.count > 0 ? (recClicks.count / prodViews.count) * 100 : 0;

      res.json({
        summary: {
          avg_response_time: responseStats.avg_duration || 0,
          total_requests: responseStats.count || 0,
          error_rate: errorRate,
          search_usage_rate: searchUsageRate,
          recommendation_ctr: recCTR
        },
        slowestEndpoints,
        failedPayments: failedPayments.map(p => ({
          created_at: p.created_at,
          ...JSON.parse(p.metadata || '{}')
        }))
      });
    } catch (err) {
      console.error('[admin] getOperationalMetrics:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getSupplierAnalytics: async (req, res) => {
    try {
      let supplierId = null;
      if (req.role === 'supplier') {
        supplierId = req.userId;
      } else if (req.role === 'admin') {
        supplierId = req.query.supplier_id || null;
      } else {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const supplierFilter = supplierId ? `AND p.supplier_id = ${Number(supplierId)}` : '';

      const revenueRes = await database.get(`
        SELECT ROUND(SUM(oi.line_total), 2) AS total,
               ROUND(SUM(oi.quantity * p.cost_price), 2) AS cogs,
               COUNT(DISTINCT oi.order_id) AS orders_count,
               SUM(oi.quantity) AS units_sold
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status != 'cancelled' ${supplierFilter}
      `);

      const totalRevenue = revenueRes.total || 0;
      const totalCogs = revenueRes.cogs || 0;
      const grossProfit = totalRevenue - totalCogs;
      const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const ordersCount = revenueRes.orders_count || 0;
      const unitsSold = revenueRes.units_sold || 0;
      const aov = ordersCount > 0 ? totalRevenue / ordersCount : 0;

      const bestSellers = await database.all(`
        SELECT p.product_id, p.product_name, SUM(oi.quantity) AS quantity, ROUND(SUM(oi.line_total), 2) AS revenue
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status != 'cancelled' ${supplierFilter}
        GROUP BY p.product_id
        ORDER BY quantity DESC
        LIMIT 5
      `);

      const lowStock = await database.all(`
        SELECT p.product_id, p.product_name, pv.sku, i.available_stock
        FROM products p
        JOIN product_variants pv ON p.product_id = pv.product_id
        JOIN inventory i ON pv.variant_id = i.variant_id
        WHERE i.available_stock <= 5 AND i.available_stock > 0 ${supplierFilter}
      `);

      const outOfStock = await database.all(`
        SELECT p.product_id, p.product_name, pv.sku
        FROM products p
        JOIN product_variants pv ON p.product_id = pv.product_id
        JOIN inventory i ON pv.variant_id = i.variant_id
        WHERE i.available_stock = 0 ${supplierFilter}
      `);

      const views = await database.all(`
        SELECT product_id, COUNT(*) AS view_count
        FROM analytics_events
        WHERE event_name = 'product_view' AND product_id IS NOT NULL
        GROUP BY product_id
      `);
      const viewsMap = {};
      views.forEach(v => { viewsMap[v.product_id] = v.view_count; });

      const prodConversion = await database.all(`
        SELECT p.product_id, p.product_name, SUM(oi.quantity) AS quantity
        FROM products p
        JOIN product_variants pv ON p.product_id = pv.product_id
        LEFT JOIN order_items oi ON pv.variant_id = oi.variant_id
        LEFT JOIN orders o ON oi.order_id = o.order_id AND o.status != 'cancelled'
        WHERE 1=1 ${supplierFilter}
        GROUP BY p.product_id
      `);
      const conversionRates = prodConversion.map(row => {
        const vCount = viewsMap[row.product_id] || 0;
        return {
          product_id: row.product_id,
          product_name: row.product_name,
          views: vCount,
          sales: row.quantity || 0,
          conversion_rate: vCount > 0 ? (row.quantity / vCount) * 100 : 0
        };
      });

      const ordersTotal = await database.get(`
        SELECT COUNT(DISTINCT oi.order_id) AS count
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        WHERE 1=1 ${supplierFilter}
      `);
      const ordersCancelled = await database.get(`
        SELECT COUNT(DISTINCT oi.order_id) AS count
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status = 'cancelled' ${supplierFilter}
      `);
      const ordersReturned = await database.get(`
        SELECT COUNT(DISTINCT oi.order_id) AS count
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status = 'returned' ${supplierFilter}
      `);
      
      const totOrders = ordersTotal.count || 0;
      const cancellationRate = totOrders > 0 ? (ordersCancelled.count / totOrders) * 100 : 0;
      const refundRate = totOrders > 0 ? (ordersReturned.count / totOrders) * 100 : 0;

      res.json({
        summary: {
          revenue: totalRevenue,
          cogs: totalCogs,
          gross_profit: grossProfit,
          gross_margin_pct: grossMarginPct,
          orders: ordersCount,
          units_sold: unitsSold,
          aov,
          cancellation_rate: cancellationRate,
          refund_rate: refundRate
        },
        bestSellers,
        lowStock,
        outOfStock,
        conversionRates
      });
    } catch (err) {
      console.error('[supplier] getSupplierAnalytics:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getDashboardSummary: async (req, res) => {
    try {
      const revenueToday = await database.get(`
        SELECT SUM(total_amount) AS revenue FROM orders
        WHERE status != 'cancelled' AND DATE(placed_at) = DATE('now')
      `);
      const pendingReqs = await database.get(`
        SELECT COUNT(*) AS count FROM order_requests WHERE status = 'pending'
      `);
      const lowStockAlerts = await database.get(`
        SELECT COUNT(*) AS count FROM inventory WHERE available_stock <= 5 AND available_stock > 0
      `);
      const totalOrdersCount = await database.get(`
        SELECT COUNT(*) AS count FROM orders WHERE status != 'cancelled'
      `);

      const topProducts = await database.all(`
        SELECT p.product_id, p.product_name, SUM(oi.quantity) AS units_sold, ROUND(SUM(oi.line_total), 2) AS revenue
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status != 'cancelled'
        GROUP BY p.product_id
        ORDER BY units_sold DESC
        LIMIT 5
      `);

      const topSuppliers = await database.all(`
        SELECT u.username AS supplier_name, ROUND(SUM(oi.line_total), 2) AS revenue
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        JOIN users u ON p.supplier_id = u.user_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status != 'cancelled'
        GROUP BY p.supplier_id
        ORDER BY revenue DESC
        LIMIT 5
      `);

      const alerts = [];
      const stockCheck = await database.all(`
        SELECT p.product_name, pv.sku, i.available_stock
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.product_id
        JOIN inventory i ON pv.variant_id = i.variant_id
        WHERE i.available_stock <= 2 AND i.available_stock > 0
      `);
      stockCheck.forEach(item => {
        alerts.push({
          type: 'STOCK_CRITICAL',
          message: `Product ${item.product_name} (${item.sku}) has only ${item.available_stock} items remaining.`
        });
      });

      const returnCheck = await database.get(`
        SELECT COUNT(*) AS count FROM returns WHERE status = 'requested'
      `);
      if (returnCheck && returnCheck.count > 0) {
        alerts.push({
          type: 'RETURN_BACKLOG',
          message: `There are ${returnCheck.count} pending return requests awaiting review.`
        });
      }

      res.json({
        kpis: {
          revenue_today: revenueToday.revenue || 0,
          pending_requests: pendingReqs.count || 0,
          low_stock_count: lowStockAlerts.count || 0,
          total_orders: totalOrdersCount.count || 0
        },
        leaderboards: {
          topProducts,
          topSuppliers
        },
        alerts
      });
    } catch (err) {
      console.error('[admin] getDashboardSummary:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },
});

module.exports = { createAdminController };
