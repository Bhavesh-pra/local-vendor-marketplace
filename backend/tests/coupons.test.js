const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { validateCouponAndCalculateDiscount } = require('../services/couponService');
const { createCouponController } = require('../controllers/couponController');

async function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  OK ${message}`);
}

async function runTests() {
  console.log('Starting Phase 5D coupon verification tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_coupons.sqlite');

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  if (!fs.existsSync(mainDbPath)) {
    throw new Error('Main database file not found. Expected backend/ecommerce.sqlite');
  }

  fs.copyFileSync(mainDbPath, testDbPath);

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  await db.run(`DROP TABLE IF EXISTS coupon_redemptions`);
  await db.run(`DROP TABLE IF EXISTS coupon_categories`);
  await db.run(`DROP TABLE IF EXISTS coupon_products`);
  await db.run(`DROP TABLE IF EXISTS coupons`);

  await db.run(`
    CREATE TABLE coupons (
      coupon_id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_code TEXT UNIQUE NOT NULL,
      coupon_type TEXT NOT NULL CHECK (coupon_type IN ('fixed', 'percentage', 'free_shipping')),
      discount_value REAL NOT NULL,
      min_order_value REAL DEFAULT 0,
      max_discount_amount REAL,
      usage_limit INTEGER,
      per_user_limit INTEGER DEFAULT 1,
      expiration_date TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.run(`
    CREATE TABLE coupon_redemptions (
      redemption_id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      discount_amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.run(`
    CREATE TABLE coupon_categories (
      coupon_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      PRIMARY KEY (coupon_id, category_id)
    )
  `);

  await db.run(`
    CREATE TABLE coupon_products (
      coupon_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      PRIMARY KEY (coupon_id, product_id)
    )
  `);

  await db.run(`DELETE FROM product_shipping`);
  await db.run(`DELETE FROM cart_items`);
  await db.run(`DELETE FROM cart`);
  await db.run(`DELETE FROM product_variants`);
  await db.run(`DELETE FROM products`);
  await db.run(`DELETE FROM categories`);
  await db.run(`DELETE FROM users WHERE user_id IN (999, 1000)`);

  await db.run(`
    INSERT INTO categories (category_id, category_name, category_slug)
    VALUES (1, 'Electronics', 'electronics'), (2, 'Apparel', 'apparel')
  `);
  await db.run(`
    INSERT INTO products (product_id, category_id, supplier_id, product_name, description, cost_price, selling_price)
    VALUES
      (10, 1, 1, 'Phone', 'Test Phone', 500, 800),
      (20, 2, 1, 'Shirt', 'Test Shirt', 100, 200)
  `);
  await db.run(`
    INSERT INTO product_variants (variant_id, product_id, size, color, sku)
    VALUES
      (100, 10, 'Default', 'Black', 'SKU-PHONE'),
      (200, 20, 'M', 'Blue', 'SKU-SHIRT')
  `);
  await db.run(`
    INSERT INTO users (user_id, username, email, password_hash, role)
    VALUES
      (999, 'coupon_test_user_999', 'coupon-test-999@example.com', 'hash', 'customer'),
      (1000, 'coupon_test_user_1000', 'coupon-test-1000@example.com', 'hash', 'customer')
  `);

  const cartRes = await db.run(`INSERT INTO cart (user_id, status) VALUES (999, 'active')`);
  const cartId = cartRes.lastID;
  const otherCartRes = await db.run(`INSERT INTO cart (user_id, status) VALUES (1000, 'active')`);
  const otherCartId = otherCartRes.lastID;
  const inactiveCartRes = await db.run(`INSERT INTO cart (user_id, status) VALUES (999, 'converted')`);
  const inactiveCartId = inactiveCartRes.lastID;

  await db.run(`INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price) VALUES (?, 100, 1, 800)`, [cartId]);
  await db.run(`INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price) VALUES (?, 200, 1, 200)`, [cartId]);
  await db.run(`INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price) VALUES (?, 100, 1, 800)`, [otherCartId]);
  await db.run(`INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price) VALUES (?, 100, 1, 800)`, [inactiveCartId]);

  console.log('Test setup completed.');

  await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value, status) VALUES ('TESTINACTIVE', 'fixed', 50, 'inactive')`);
  let res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTINACTIVE');
  await assert(res.valid === false && res.message.includes('no longer active'), 'Inactive coupon rejected');

  await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value, expiration_date) VALUES ('TESTEXPIRED', 'fixed', 50, '2020-01-01')`);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTEXPIRED');
  await assert(res.valid === false && res.message.includes('expired'), 'Expired coupon rejected');

  await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value, min_order_value) VALUES ('TESTMINVAL', 'fixed', 50, 1500)`);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTMINVAL');
  await assert(res.valid === false && res.message.includes('Minimum order value'), 'Minimum order value restriction enforced');

  await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value) VALUES ('TESTFIXED', 'fixed', 1200)`);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTFIXED');
  await assert(res.valid === true && res.discount_amount === 1000, 'Fixed coupon discount capped at subtotal');
  await assert(res.coupon?.coupon_code === 'TESTFIXED', 'Coupon details returned in validation payload');

  await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value, max_discount_amount) VALUES ('TESTPERCENT', 'percentage', 20, 150)`);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTPERCENT');
  await assert(res.valid === true && res.discount_amount === 150, 'Percentage coupon max cap enforced');

  await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value) VALUES ('TESTSHIPPING', 'free_shipping', 0)`);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTSHIPPING');
  await assert(res.valid === true && res.shipping_fee === 0 && res.discount_amount === 0, 'Free shipping coupon preserves already-free shipping tier');

  await db.run(`UPDATE cart_items SET unit_price = 400 WHERE cart_id = ? AND variant_id = 100`, [cartId]);
  await db.run(`DELETE FROM cart_items WHERE cart_id = ? AND variant_id = 200`, [cartId]);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTSHIPPING');
  await assert(res.valid === true && res.shipping_fee === 80 && res.discount_amount === 80 && res.final_total === 400, 'Free shipping coupon waives paid shipping tier');
  await db.run(`UPDATE cart_items SET unit_price = 800 WHERE cart_id = ? AND variant_id = 100`, [cartId]);
  await db.run(`INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price) VALUES (?, 200, 1, 200)`, [cartId]);

  const usageLimitRes = await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value, usage_limit) VALUES ('TESTUSAGE', 'fixed', 50, 1)`);
  await db.run(`INSERT INTO coupon_redemptions (coupon_id, order_id, user_id, discount_amount) VALUES (?, 1001, 888, 50)`, [usageLimitRes.lastID]);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTUSAGE');
  await assert(res.valid === false && res.message.includes('usage limit'), 'Global usage limit enforced');

  const perUserRes = await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value, per_user_limit) VALUES ('TESTUSERLIMIT', 'fixed', 50, 2)`);
  await db.run(`INSERT INTO coupon_redemptions (coupon_id, order_id, user_id, discount_amount) VALUES (?, 1002, 999, 50)`, [perUserRes.lastID]);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTUSERLIMIT');
  await assert(res.valid === true, 'Coupon remains valid while below per-user limit');
  await db.run(`INSERT INTO coupon_redemptions (coupon_id, order_id, user_id, discount_amount) VALUES (?, 1003, 999, 50)`, [perUserRes.lastID]);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTUSERLIMIT');
  await assert(res.valid === false && res.message.includes('maximum number of times'), 'Per-user limit enforced');

  const catCouponRes = await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value) VALUES ('TESTCATONLY', 'percentage', 10)`);
  await db.run(`INSERT INTO coupon_categories (coupon_id, category_id) VALUES (?, 2)`, [catCouponRes.lastID]);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTCATONLY');
  await assert(res.valid === true && res.discount_amount === 20, 'Category restriction uses OR logic');

  const prodCouponRes = await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value) VALUES ('TESTPRODONLY', 'percentage', 10)`);
  await db.run(`INSERT INTO coupon_products (coupon_id, product_id) VALUES (?, 10)`, [prodCouponRes.lastID]);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTPRODONLY');
  await assert(res.valid === true && res.discount_amount === 80, 'Product restriction uses OR logic');

  const combinedCouponRes = await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value) VALUES ('TESTCOMBINED', 'percentage', 10)`);
  await db.run(`INSERT INTO coupon_categories (coupon_id, category_id) VALUES (?, 2)`, [combinedCouponRes.lastID]);
  await db.run(`INSERT INTO coupon_products (coupon_id, product_id) VALUES (?, 10)`, [combinedCouponRes.lastID]);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTCOMBINED');
  await assert(res.valid === true && res.discount_amount === 100, 'Combined category and product restrictions apply with OR semantics');

  const missCouponRes = await db.run(`INSERT INTO coupons (coupon_code, coupon_type, discount_value) VALUES ('TESTMISS', 'percentage', 10)`);
  await db.run(`INSERT INTO coupon_categories (coupon_id, category_id) VALUES (?, 9999)`, [missCouponRes.lastID]);
  res = await validateCouponAndCalculateDiscount(db, 999, cartId, 'TESTMISS');
  await assert(res.valid === false && res.message.includes('No items in your cart qualify'), 'Non-matching restriction rejects coupon');

  res = await validateCouponAndCalculateDiscount(db, 999, otherCartId, 'TESTFIXED');
  await assert(res.valid === false && res.message.includes('Cart not found for this user'), 'Validation rejects coupons against another user cart');

  res = await validateCouponAndCalculateDiscount(db, 999, inactiveCartId, 'TESTFIXED');
  await assert(res.valid === false && res.message.includes('Only active carts'), 'Validation rejects inactive carts');

  const adminController = createCouponController(db);
  let statusCode = null;
  let payload = null;
  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
  };

  await adminController.updateCoupon(
    { params: { id: perUserRes.lastID }, body: { discount_value: 99 } },
    mockRes
  );
  await assert(statusCode === 400 && payload.message.includes('Cannot modify coupon_type or discount_value'), 'Admin mutation lock blocks financial changes after redemption');

  statusCode = null;
  payload = null;
  await adminController.updateCoupon(
    { params: { id: perUserRes.lastID }, body: { status: 'inactive' } },
    mockRes
  );
  await assert(statusCode === null && payload.message.includes('updated successfully'), 'Admin can still change allowed fields after redemption');

  await db.close();
  fs.unlinkSync(testDbPath);
  console.log('All Phase 5D coupon verification tests passed.');
}

runTests().catch(async (error) => {
  console.error('Test run failed:', error);
  process.exit(1);
});
