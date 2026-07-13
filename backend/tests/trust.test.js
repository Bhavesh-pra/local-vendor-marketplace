/**
 * Phase 5F — Trust Signals & Conversion Layer Automated Tests
 */
const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { calculateOrderSummary } = require('../services/pricingService');
const { createProductController } = require('../controllers/productController');
const { createCartController } = require('../controllers/cartController');

async function runTests() {
  console.log('Starting Phase 5F Trust Signals & Conversion Layer Verification Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_trust.sqlite');

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  // Cleanup potential table constraints and insert clean mock records
  await db.run('DELETE FROM reviews');
  await db.run('DELETE FROM order_items');
  await db.run('DELETE FROM orders');
  await db.run('DELETE FROM cart_items');
  await db.run('DELETE FROM cart');
  await db.run('DELETE FROM product_variants');
  await db.run('DELETE FROM products');
  await db.run('DELETE FROM return_policies');
  await db.run('DELETE FROM product_shipping');
  await db.run('DELETE FROM coupons');

  // Insert mock objects
  const USER_ID = 555;
  const PRODUCT_ID = 5501;
  const VARIANT_ID = 55011;
  const POLICY_ID = 22;
  const COUPON_ID = 12;

  // Insert mock user
  await db.run(
    'INSERT INTO users (user_id, username, email, password_hash, role) VALUES (?, "trustuser", "trust@user.com", "hash", "customer")',
    [USER_ID]
  );

  // Insert return policy (returnable, 30 days)
  await db.run(
    'INSERT INTO return_policies (policy_id, name, type, days) VALUES (?, "30 Days Return Policy", "returnable", 30)',
    [POLICY_ID]
  );

  // Insert product with MRP 1200 and selling price 1000 (markdown: 200)
  await db.run(
    `INSERT INTO products (product_id, category_id, supplier_id, product_name, brand, description, mrp, selling_price, cost_price, return_policy_id, product_status)
     VALUES (?, 1, 1, "Trust Product", "BrandA", "High-quality test product", 1200, 1000, 800, ?, "active")`,
    [PRODUCT_ID, POLICY_ID]
  );

  // Insert variant
  await db.run(
    'INSERT INTO product_variants (variant_id, product_id, size, color, sku, status) VALUES (?, ?, "M", "Red", "SKU-TRUST-M-RED", "active")',
    [VARIANT_ID, PRODUCT_ID]
  );

  // Insert shipping config (not free shipping, COD available)
  await db.run(
    'INSERT INTO product_shipping (product_id, weight, length, width, height, shipping_class, cod_available, free_shipping) VALUES (?, 1.5, 10, 10, 10, "standard", 1, 0)',
    [PRODUCT_ID]
  );

  // Helper assertions
  const assert = (condition, message) => {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      process.exit(1);
    } else {
      console.log(`✅ PASSED: ${message}`);
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // Test 1: Return policy string mapping
  // ────────────────────────────────────────────────────────────────────────
  console.log('\nRunning Test 1: Return policy string mapping...');
  const productController = createProductController(db);

  let mockResponse = {};
  const mockRes = {
    json: (data) => { mockResponse = data; },
    status: function(code) { this.statusCode = code; return this; }
  };

  await productController.getProduct(
    { params: { product_id: PRODUCT_ID.toString() }, headers: {} },
    mockRes
  );

  assert(mockResponse.return_policy !== null, 'Return policy was loaded');
  assert(
    mockResponse.return_policy.message === '30 Day Returns',
    `Expected returns policy message "30 Day Returns", got "${mockResponse.return_policy.message}"`
  );

  // Verify non_returnable returns "Non Returnable"
  await db.run('UPDATE return_policies SET type = "non_returnable" WHERE policy_id = ?', [POLICY_ID]);
  await productController.getProduct(
    { params: { product_id: PRODUCT_ID.toString() }, headers: {} },
    mockRes
  );
  assert(
    mockResponse.return_policy.message === 'Non Returnable',
    `Expected non-returnable message "Non Returnable", got "${mockResponse.return_policy.message}"`
  );

  // Verify replacement_only returns "15 Day Replacement"
  await db.run('UPDATE return_policies SET type = "replacement_only", days = 15 WHERE policy_id = ?', [POLICY_ID]);
  await productController.getProduct(
    { params: { product_id: PRODUCT_ID.toString() }, headers: {} },
    mockRes
  );
  assert(
    mockResponse.return_policy.message === '15 Day Replacement',
    `Expected replacement message "15 Day Replacement", got "${mockResponse.return_policy.message}"`
  );

  // Restore policy to returnable, 30 days
  await db.run('UPDATE return_policies SET type = "returnable", days = 30 WHERE policy_id = ?', [POLICY_ID]);

  // ────────────────────────────────────────────────────────────────────────
  // Test 2: Exclude hidden reviews from counts and rating averages
  // ────────────────────────────────────────────────────────────────────────
  console.log('\nRunning Test 2: Exclude hidden reviews from product details...');

  // Approved review (rating 5)
  await db.run(
    'INSERT INTO reviews (product_id, user_id, rating, title, comment, status, is_verified_purchase) VALUES (?, ?, 5, "Great", "Great product!", "approved", 1)',
    [PRODUCT_ID, USER_ID]
  );
  // Hidden review (rating 1)
  await db.run(
    'INSERT INTO reviews (product_id, user_id, rating, title, comment, status, is_verified_purchase) VALUES (?, ?, 1, "Awful", "Awful product!", "hidden", 1)',
    [PRODUCT_ID, USER_ID]
  );

  await productController.getProduct(
    { params: { product_id: PRODUCT_ID.toString() }, headers: {} },
    mockRes
  );

  assert(mockResponse.reviews_count === 1, `Expected reviews count to ignore hidden reviews (expected 1, got ${mockResponse.reviews_count})`);
  assert(mockResponse.average_rating === 5, `Expected average rating to ignore hidden reviews (expected 5, got ${mockResponse.average_rating})`);

  // ────────────────────────────────────────────────────────────────────────
  // Test 3: Purchases and verified review counts in trust_metrics DTO
  // ────────────────────────────────────────────────────────────────────────
  console.log('\nRunning Test 3: Trust metrics DTO values...');

  // Verified review count should exclude hidden verified reviews
  assert(
    mockResponse.trust_metrics.verified_reviews_count === 1,
    `Expected verified review count 1, got ${mockResponse.trust_metrics.verified_reviews_count}`
  );
  assert(
    mockResponse.trust_metrics.rating_average === 5,
    `Expected rating average 5, got ${mockResponse.trust_metrics.rating_average}`
  );

  // Insert mock orders: one successful (status 'delivered'), one cancelled ('cancelled')
  await db.run(
    `INSERT INTO orders (order_id, user_id, order_number, status, payment_method, total_amount, subtotal_amount, shipping_amount, tax_amount, customer_name, customer_email, address_line_1, customer_phone)
     VALUES (101, ?, "ORD-101", "delivered", "COD", 1000, 1000, 0, 0, "trustuser", "trust@user.com", "Address 1", "9876543210")`,
    [USER_ID]
  );
  await db.run(
    'INSERT INTO order_items (order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (101, ?, 3, 1000, 3000, 1)',
    [VARIANT_ID]
  );

  await db.run(
    `INSERT INTO orders (order_id, user_id, order_number, status, payment_method, total_amount, subtotal_amount, shipping_amount, tax_amount, customer_name, customer_email, address_line_1, customer_phone)
     VALUES (102, ?, "ORD-102", "cancelled", "COD", 1000, 1000, 0, 0, "trustuser", "trust@user.com", "Address 1", "9876543210")`,
    [USER_ID]
  );
  await db.run(
    'INSERT INTO order_items (order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (102, ?, 2, 1000, 2000, 1)',
    [VARIANT_ID]
  );

  await productController.getProduct(
    { params: { product_id: PRODUCT_ID.toString() }, headers: {} },
    mockRes
  );

  assert(
    mockResponse.trust_metrics.purchases_count === 3,
    `Expected purchases count 3 (only count delivered orders, ignore cancelled), got ${mockResponse.trust_metrics.purchases_count}`
  );

  // ────────────────────────────────────────────────────────────────────────
  // Test 4: pricingService order summary calculations
  // ────────────────────────────────────────────────────────────────────────
  console.log('\nRunning Test 4: Pricing calculations and coupon validations...');

  // Setup active cart and cart items
  const CART_ID = 50;
  await db.run(
    'INSERT INTO cart (cart_id, user_id, status) VALUES (?, ?, "active")',
    [CART_ID, USER_ID]
  );
  // Add 1 quantity of VARIANT_ID (unit price 1000)
  await db.run(
    'INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price) VALUES (?, ?, 1, 1000)',
    [CART_ID, VARIANT_ID]
  );

  // Call calculateOrderSummary
  let summary = await calculateOrderSummary(db, USER_ID);
  assert(summary.original_price === 1200, `Expected MRP subtotal 1200, got ${summary.original_price}`);
  assert(summary.subtotal === 1000, `Expected subtotal 1000, got ${summary.subtotal}`);
  assert(summary.discount_amount === 200, `Expected discount 200, got ${summary.discount_amount}`);
  // Subtotal is 1000, which satisfies free shipping threshold (>= 1000)
  assert(summary.shipping_fee === 0, `Expected free shipping for subtotal 1000, got ${summary.shipping_fee}`);
  assert(summary.final_total === 1000, `Expected final total 1000, got ${summary.final_total}`);

  // Decrease quantity to 1 of 600 selling price, 800 MRP, 500 cost_price
  await db.run('UPDATE cart_items SET quantity = 1, unit_price = 600 WHERE cart_id = ?', [CART_ID]);
  await db.run('UPDATE products SET mrp = 800, selling_price = 600, cost_price = 500 WHERE product_id = ?', [PRODUCT_ID]);

  summary = await calculateOrderSummary(db, USER_ID);
  assert(summary.original_price === 800, `Expected MRP subtotal 800, got ${summary.original_price}`);
  assert(summary.subtotal === 600, `Expected subtotal 600, got ${summary.subtotal}`);
  assert(summary.discount_amount === 200, `Expected discount 200, got ${summary.discount_amount}`);
  // Subtotal 600: shipping fee should be 50 (tier: >= 500 & < 800)
  assert(summary.shipping_fee === 50, `Expected shipping fee 50, got ${summary.shipping_fee}`);
  assert(summary.final_total === 650, `Expected final total 650, got ${summary.final_total}`);

  // ────────────────────────────────────────────────────────────────────────
  // Test 5: Coupon validation inside pricingService
  // ────────────────────────────────────────────────────────────────────────
  console.log('\nRunning Test 5: Coupon validation pricing checks...');

  // Insert percentage discount coupon: SAVE10 (10% off)
  await db.run(
    `INSERT INTO coupons (coupon_id, coupon_code, coupon_type, discount_value, min_order_value, status, expiration_date)
     VALUES (?, "SAVE10", "percentage", 10, 500, "active", date('now', '+1 day'))`,
    [COUPON_ID]
  );

  summary = await calculateOrderSummary(db, USER_ID, 'SAVE10');
  assert(summary.coupon_valid === true, 'Coupon SAVE10 is valid');
  assert(summary.coupon_savings === 60, `Expected 10% coupon savings of 600 subtotal (= 60), got ${summary.coupon_savings}`);
  assert(summary.final_total === 590, `Expected final total (600 subtotal + 50 shipping - 60 coupon discount = 590), got ${summary.final_total}`);

  // Verify redemption count in coupon_redemptions table is NOT mutated (i.e. remains empty)
  const redemptionsCount = await db.get('SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ?', [COUPON_ID]);
  assert(
    redemptionsCount.count === 0,
    `Expected summary pricing calculations to never mutate coupon redemptions (expected 0, got ${redemptionsCount.count})`
  );

  // ────────────────────────────────────────────────────────────────────────
  // Test 6: Cart summary endpoint boundary check
  // ────────────────────────────────────────────────────────────────────────
  console.log('\nRunning Test 6: Cart summary endpoint active user boundaries...');

  const cartController = createCartController(db);
  let summaryResponse = {};
  const mockCartRes = {
    json: (data) => { summaryResponse = data; },
    status: function(code) { this.statusCode = code; return this; }
  };

  // Check endpoint resolves active cart summary automatically using req.userId (555) without passing cartId
  await cartController.getCartSummary(
    { userId: USER_ID, query: { coupon_code: 'SAVE10' } },
    mockCartRes
  );

  assert(summaryResponse.final_total === 590, `Expected resolved cart summary total 590, got ${summaryResponse.final_total}`);
  assert(summaryResponse.coupon_savings === 60, `Expected resolved coupon savings 60, got ${summaryResponse.coupon_savings}`);

  console.log('\n🎉 ALL PHASE 5F TRUST SIGNALS & PRICING TESTS PASSED SUCCESSFULLY!');
  
  await db.close();
  // Remove test DB file
  fs.unlinkSync(testDbPath);
  console.log('Cleaned up test database file.');
}

runTests().catch((err) => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});
