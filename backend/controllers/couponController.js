/**
 * Phase 5D — Coupon Controller
 */
const { validateCouponAndCalculateDiscount } = require('../services/couponService');

const createCouponController = (database) => ({

  // ─── POST /coupons/validate ───────────────────────────────────────────────
  validateCoupon: async (req, res) => {
    try {
      const { coupon_code, cart_id } = req.body;

      if (!coupon_code || !cart_id) {
        return res.status(400).json({ valid: false, message: 'coupon_code and cart_id are required.' });
      }

      const result = await validateCouponAndCalculateDiscount(database, req.userId, cart_id, coupon_code);
      res.json(result);
    } catch (err) {
      res.status(500).json({ valid: false, message: 'Database error: ' + err.message });
    }
  },

  // ─── GET /admin/coupons ───────────────────────────────────────────────────
  getAllCoupons: async (req, res) => {
    try {
      const coupons = await database.all(`SELECT * FROM coupons ORDER BY created_at DESC`);

      for (const coupon of coupons) {
        const { count } = await database.get(
          `SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ?`,
          [coupon.coupon_id]
        );
        coupon.redemption_count = count;

        coupon.categories = await database.all(
          `SELECT cc.category_id, c.category_name
           FROM coupon_categories cc
           LEFT JOIN categories c ON cc.category_id = c.category_id
           WHERE cc.coupon_id = ?`,
          [coupon.coupon_id]
        );

        coupon.products = await database.all(
          `SELECT cp.product_id, p.product_name
           FROM coupon_products cp
           LEFT JOIN products p ON cp.product_id = p.product_id
           WHERE cp.coupon_id = ?`,
          [coupon.coupon_id]
        );
      }

      res.json(coupons);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  // ─── POST /admin/coupons ──────────────────────────────────────────────────
  createCoupon: async (req, res) => {
    try {
      const {
        coupon_code, coupon_type, discount_value,
        min_order_value, max_discount_amount,
        usage_limit, per_user_limit,
        expiration_date, status,
        category_ids, product_ids
      } = req.body;

      if (!coupon_code || !coupon_type || discount_value === undefined || discount_value === null) {
        return res.status(400).json({ message: 'coupon_code, coupon_type, and discount_value are required.' });
      }

      const validTypes = ['fixed', 'percentage', 'free_shipping'];
      if (!validTypes.includes(coupon_type)) {
        return res.status(400).json({ message: 'Invalid coupon_type. Must be: fixed, percentage, or free_shipping.' });
      }

      const result = await database.run(
        `INSERT INTO coupons (coupon_code, coupon_type, discount_value, min_order_value, max_discount_amount, usage_limit, per_user_limit, expiration_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          coupon_code,
          coupon_type,
          discount_value,
          min_order_value || 0,
          max_discount_amount || null,
          usage_limit || null,
          per_user_limit !== undefined ? per_user_limit : 1,
          expiration_date || null,
          status || 'active'
        ]
      );

      const couponId = result.lastID;

      // Insert category restrictions
      if (category_ids && Array.isArray(category_ids)) {
        for (const catId of category_ids) {
          await database.run(
            `INSERT INTO coupon_categories (coupon_id, category_id) VALUES (?, ?)`,
            [couponId, catId]
          );
        }
      }

      // Insert product restrictions
      if (product_ids && Array.isArray(product_ids)) {
        for (const prodId of product_ids) {
          await database.run(
            `INSERT INTO coupon_products (coupon_id, product_id) VALUES (?, ?)`,
            [couponId, prodId]
          );
        }
      }

      res.status(201).json({ message: 'Coupon created successfully', coupon_id: couponId });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ message: 'A coupon with this code already exists.' });
      }
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  // ─── PATCH /admin/coupons/:id ─────────────────────────────────────────────
  updateCoupon: async (req, res) => {
    try {
      const { id } = req.params;

      const coupon = await database.get(`SELECT * FROM coupons WHERE coupon_id = ?`, [id]);
      if (!coupon) {
        return res.status(404).json({ message: 'Coupon not found.' });
      }

      // Check if coupon has redemptions — block coupon_type and discount_value changes
      const { count } = await database.get(
        `SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ?`,
        [id]
      );

      if (count > 0) {
        if (req.body.coupon_type !== undefined || req.body.discount_value !== undefined) {
          return res.status(400).json({
            message: 'Cannot modify coupon_type or discount_value for a coupon that has existing redemptions.'
          });
        }
      }

      // Build dynamic update for allowed fields
      const allowedFields = ['status', 'expiration_date', 'usage_limit', 'per_user_limit'];
      const updates = [];
      const values = [];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(req.body[field]);
        }
      }

      // Also allow coupon_type and discount_value if no redemptions
      if (count === 0) {
        if (req.body.coupon_type !== undefined) {
          updates.push('coupon_type = ?');
          values.push(req.body.coupon_type);
        }
        if (req.body.discount_value !== undefined) {
          updates.push('discount_value = ?');
          values.push(req.body.discount_value);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'No valid fields to update.' });
      }

      updates.push("updated_at = datetime('now')");
      values.push(id);

      await database.run(
        `UPDATE coupons SET ${updates.join(', ')} WHERE coupon_id = ?`,
        values
      );

      res.json({ message: 'Coupon updated successfully.' });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  }
});

module.exports = { createCouponController };
