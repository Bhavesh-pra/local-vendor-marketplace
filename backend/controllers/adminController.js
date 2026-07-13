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
        revenue,
        ordersCount,
        customersCount,
        productsCount,
        pendingRequests,
        activeAlerts,
        lowStock,
        pendingOrders,
        processingOrders,
        returnedOrders,
        newCustomersWeek
      ] = await Promise.all([
        database.get(`SELECT IFNULL(ROUND(SUM(total_amount),2), 0) AS total FROM orders WHERE status != 'cancelled'`),
        database.get(`SELECT COUNT(*) AS count FROM orders`),
        database.get(`SELECT COUNT(*) AS count FROM users WHERE role = 'customer'`),
        database.get(`SELECT COUNT(*) AS count FROM products WHERE product_status = 'active'`),
        database.get(`SELECT COUNT(*) AS count FROM order_requests WHERE status = 'pending'`),
        database.get(`SELECT COUNT(*) AS count FROM alerts WHERE resolved_at IS NULL`),
        database.get(`
          SELECT COUNT(*) AS count 
          FROM inventory i 
          JOIN product_variants pv ON i.variant_id = pv.variant_id
          JOIN products p ON pv.product_id = p.product_id
          WHERE i.available_stock <= i.reorder_level 
            AND pv.status <> 'archived' 
            AND p.product_status <> 'archived'
        `),
        database.get(`SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'`),
        database.get(`SELECT COUNT(*) AS count FROM orders WHERE status = 'processing'`),
        database.get(`SELECT COUNT(*) AS count FROM orders WHERE status = 'returned'`),
        database.get(`SELECT COUNT(*) AS count FROM users WHERE role = 'customer' AND created_at >= datetime('now', '-7 days')`),
      ]);

      const recentOrders = await database.all(`
        SELECT order_id, order_number, customer_name, total_amount, status, placed_at
        FROM orders
        ORDER BY placed_at DESC
        LIMIT 6
      `);

      const recentCustomers = await database.all(`
        SELECT u.user_id, u.username, u.email, u.created_at,
               COUNT(DISTINCT o.order_id) AS order_count,
               IFNULL(ROUND(SUM(CASE WHEN o.status NOT IN ('cancelled', 'returned') THEN o.total_amount ELSE 0 END), 2), 0) AS total_spending
        FROM users u
        LEFT JOIN orders o ON u.user_id = o.user_id
        WHERE u.role = 'customer'
        GROUP BY u.user_id
        ORDER BY u.created_at DESC
        LIMIT 5
      `);

      res.json({
        stats: {
          revenue: revenue.total,
          orders: ordersCount.count,
          customers: customersCount.count,
          products: productsCount.count,
          pendingRequests: pendingRequests.count,
          stockAlerts: activeAlerts.count,
          lowStockCount: lowStock.count,
          pendingOrdersCount: pendingOrders.count,
          processingOrdersCount: processingOrders.count,
          returnedOrdersCount: returnedOrders.count,
          newCustomersThisWeek: newCustomersWeek.count,
        },
        recentOrders,
        recentCustomers,
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
                await database.run(
                  `INSERT INTO inventory_movements (variant_id, change, reason, created_by)
                   VALUES (?, ?, 'manual_adjustment', ?)`,
                  [v.variant_id, change, req.username || 'admin']
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
                `INSERT INTO inventory_movements (variant_id, change, reason, created_by)
                 VALUES (?, ?, 'manual_adjustment', ?)`,
                [variant_id, initialStock, req.username || 'admin']
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
      const base64Data = fileData.includes(';base64,') ? fileData.split(';base64,')[1] : fileData;
      const buffer = Buffer.from(base64Data, 'base64');
      
      const ext = path.extname(fileName) || '.jpg';
      const isVideo = ext.toLowerCase() === '.mp4';
      const subFolder = isVideo ? 'videos' : 'products';
      
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
      const uploadDir = path.join(__dirname, '../uploads', subFolder);
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, uniqueName);
      fs.writeFileSync(filePath, buffer);
      
      const relativePath = `/uploads/${subFolder}/${uniqueName}`;
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
             VALUES (?, ?, ?, 0, ?, ?, datetime('now'))`,
            [
              new_variant_id,
              inv.supplier_id,
              inv.available_stock,
              inv.reorder_level,
              inv.purchase_price
            ]
          );

          if (inv.available_stock > 0) {
            await database.run(
              `INSERT INTO inventory_movements (variant_id, change, reason, created_by)
               VALUES (?, ?, 'manual_adjustment', ?)`,
              [new_variant_id, inv.available_stock, req.username || 'admin']
            );
          }
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
              await database.run(
                `UPDATE inventory 
                 SET available_stock = available_stock + ?, updated_at = datetime('now') 
                 WHERE variant_id = ?`,
                [item.quantity, item.variant_id]
              );

              await database.run(
                `INSERT INTO inventory_movements (variant_id, change, reason, created_by)
                 VALUES (?, ?, 'cancellation', ?)`,
                [item.variant_id, item.quantity, req.username || 'admin']
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
              await database.run(
                `UPDATE inventory 
                 SET available_stock = available_stock + ?, updated_at = datetime('now') 
                 WHERE variant_id = ?`,
                [item.quantity, item.variant_id]
              );

              await database.run(
                `INSERT INTO inventory_movements (variant_id, change, reason, created_by)
                 VALUES (?, ?, 'return', ?)`,
                [item.variant_id, item.quantity, req.username || 'admin']
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
    const { variant_id, change, reason } = req.body;
    
    if (!variant_id || change === undefined || !reason) {
      return res.status(400).json({ message: 'variant_id, change, and reason are required' });
    }
    
    if (!['purchase', 'sale', 'cancellation', 'return', 'manual_adjustment'].includes(reason)) {
      return res.status(400).json({ message: 'Invalid adjustment reason' });
    }
    
    const qtyChange = parseInt(change, 10);
    if (isNaN(qtyChange)) {
      return res.status(400).json({ message: 'Change must be an integer' });
    }
    
    try {
      const inv = await database.get('SELECT * FROM inventory WHERE variant_id = ?', [variant_id]);
      if (!inv) return res.status(404).json({ message: 'Inventory record not found' });
      
      const newStock = inv.available_stock + qtyChange;
      if (newStock < 0) {
        return res.status(400).json({ message: 'Adjustment would result in negative stock' });
      }
      
      await database.run('BEGIN TRANSACTION');
      try {
        // Update stock
        await database.run(`
          UPDATE inventory 
          SET available_stock = ?, 
              last_restock_date = CASE WHEN ? > 0 THEN datetime('now') ELSE last_restock_date END,
              updated_at = datetime('now')
          WHERE variant_id = ?
        `, [newStock, qtyChange, variant_id]);
        
        // Log movement
        await database.run(`
          INSERT INTO inventory_movements (variant_id, change, reason, created_by)
          VALUES (?, ?, ?, ?)
        `, [variant_id, qtyChange, reason, req.username || 'admin']);
        
        // Handle low stock / out of stock alerts
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
          // If stock goes back above reorder level, auto-resolve alerts
          await database.run(`
            UPDATE alerts 
            SET resolved_at = datetime('now'), is_read = 1 
            WHERE variant_id = ? AND resolved_at IS NULL
          `, [variant_id]);
        }
        
        await database.run('COMMIT');
        res.json({ message: 'Inventory adjusted successfully', newStock });
      } catch (txErr) {
        await database.run('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      console.error('[admin] adjustInventory:', err.message);
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
});

module.exports = { createAdminController };
