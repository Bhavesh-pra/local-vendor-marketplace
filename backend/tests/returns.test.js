const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { getReturnEligibility } = require('../services/returnEligibility');
const { createProductController } = require('../controllers/productController');
const { createOrderController } = require('../controllers/orderController');
const { createAdminController } = require('../controllers/adminController');

async function runTests() {
  console.log('Starting Phase 5A Returns Infrastructure Verification Tests...');
  const failures = [];
  const expect = (condition, message, details) => {
    if (condition) {
      console.log(`SUCCESS: ${message}`);
      return;
    }
    failures.push(message);
    console.error(`FAIL: ${message}`, details ?? '');
  };

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_returns.sqlite');

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  // Ensure tables and columns exist
  await db.run(`
    CREATE TABLE IF NOT EXISTS return_policies (
      policy_id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      type        TEXT NOT NULL CHECK (type IN ('returnable', 'replacement_only', 'non_returnable')),
      days        INTEGER NOT NULL CHECK (days >= 0),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Helper functions for tables altering
  async function addColumn(tableName, colName, colType) {
    try {
      await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType}`);
    } catch (e) {
      // Column might already exist
    }
  }
  await addColumn('products', 'return_policy_id', 'INTEGER REFERENCES return_policies(policy_id)');
  await addColumn('orders', 'delivered_at', 'DATETIME NULL');

  // Seed test return policies
  await db.run('DELETE FROM return_policies');
  await db.run(`
    INSERT INTO return_policies (policy_id, name, type, days) VALUES
      (1, 'Returnable 7 Days', 'returnable', 7),
      (2, 'Returnable 10 Days', 'returnable', 10),
      (3, 'Returnable 30 Days', 'returnable', 30),
      (4, 'Replacement Only 7 Days', 'replacement_only', 7),
      (5, 'Non Returnable', 'non_returnable', 0)
  `);

  // Insert mock category
  await db.run('INSERT OR IGNORE INTO categories (category_id, category_name, category_slug) VALUES (999, "Electronics", "electronics")');

  // Insert mock products with different policies
  await db.run('DELETE FROM products WHERE product_id >= 9900');
  await db.run(`
    INSERT INTO products (product_id, supplier_id, category_id, product_name, brand, selling_price, cost_price, mrp, product_status, return_policy_id, slug, description) VALUES
      (9901, 1, 999, 'Returnable Laptop', 'BrandX', 1000, 800, 1200, 'active', 3, 'ret-lap', 'laptop desc'),
      (9902, 1, 999, 'Replacement Phone', 'BrandY', 500, 400, 600, 'active', 4, 'rep-pho', 'phone desc'),
      (9903, 1, 999, 'Non Returnable SIM Card', 'BrandZ', 10, 8, 15, 'active', 5, 'non-sim', 'sim desc')
  `);

  // Insert variants
  await db.run('DELETE FROM product_variants WHERE product_id >= 9900');
  await db.run(`
    INSERT INTO product_variants (variant_id, product_id, sku, size, color, price_override, cost_override, mrp_override, status) VALUES
      (99011, 9901, 'SKU-99011', '16GB', 'Silver', 1000, 800, 1200, 'active'),
      (99021, 9902, 'SKU-99021', '128GB', 'Black', 500, 400, 600, 'active'),
      (99031, 9903, 'SKU-99031', 'Standard', 'Blue', 10, 8, 15, 'active')
  `);

  // Mock orders
  await db.run('DELETE FROM orders WHERE order_id >= 9900');
  await db.run('DELETE FROM order_items WHERE order_id >= 9900');

  // Insert mock supplier
  await db.run('INSERT OR IGNORE INTO suppliers (supplier_id, supplier_name) VALUES (1, "Supplier1")');

  // Order 9901: Delivered, valid return window (let's say delivered 2 days ago)
  const deliveredRecent = new Date();
  deliveredRecent.setDate(deliveredRecent.getDate() - 2);
  await db.run(
    'INSERT INTO orders (order_id, user_id, order_number, status, total_amount, payment_status, payment_method, customer_name, customer_email, delivered_at) VALUES (9901, 999, "ORD-9901", "delivered", 1000, "paid", "CARD", "Test User", "test@user.com", ?)',
    [deliveredRecent.toISOString()]
  );
  await db.run(
    'INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (99011, 9901, 99011, 1, 1000, 1000, 1)'
  );

  // Order 9902: Delivered, expired return window (let's say delivered 15 days ago)
  const deliveredOld = new Date();
  deliveredOld.setDate(deliveredOld.getDate() - 15);
  await db.run(
    'INSERT INTO orders (order_id, user_id, order_number, status, total_amount, payment_status, payment_method, customer_name, customer_email, delivered_at) VALUES (9902, 999, "ORD-9902", "delivered", 500, "paid", "CARD", "Test User", "test@user.com", ?)',
    [deliveredOld.toISOString()]
  );
  await db.run(
    'INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (99021, 9902, 99021, 1, 500, 500, 1)'
  );

  // Order 9903: Shipped (not delivered)
  await db.run(
    'INSERT INTO orders (order_id, user_id, order_number, status, total_amount, payment_status, payment_method, customer_name, customer_email) VALUES (9903, 999, "ORD-9903", "shipped", 10, "paid", "CARD", "Test User", "test@user.com")'
  );
  await db.run(
    'INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (99031, 9903, 99031, 1, 10, 10, 1)'
  );

  // Order 9904: Delivered, but delivered_at is null (testing DELIVERY_DATE_MISSING)
  await db.run(
    'INSERT INTO orders (order_id, user_id, order_number, status, total_amount, payment_status, payment_method, customer_name, customer_email, delivered_at) VALUES (9904, 999, "ORD-9904", "delivered", 1000, "paid", "CARD", "Test User", "test@user.com", NULL)'
  );
  await db.run(
    'INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (99041, 9904, 99011, 1, 1000, 1000, 1)'
  );


  // ─── Assertions ───

  // Test 1: getReturnEligibility - NOT_DELIVERED
  console.log('\nAsserting NOT_DELIVERED eligibility...');
  let res1 = await getReturnEligibility(db, 9903, 99031);
  expect(res1.status === 'NOT_DELIVERED' && res1.message === 'Order not delivered yet', 'NOT_DELIVERED evaluated correctly.', res1);

  // Test 2: getReturnEligibility - DELIVERY_DATE_MISSING
  console.log('\nAsserting DELIVERY_DATE_MISSING eligibility...');
  let res2 = await getReturnEligibility(db, 9904, 99011);
  expect(res2.status === 'DELIVERY_DATE_MISSING' && res2.message === 'Delivery date information missing', 'DELIVERY_DATE_MISSING evaluated correctly.', res2);

  // Test 3: getReturnEligibility - NON_RETURNABLE
  console.log('\nAsserting NON_RETURNABLE eligibility...');
  let res3 = await getReturnEligibility(db, 9901, 99031); // Delivered order 9901, non-returnable variant 99031
  expect(res3.status === 'NON_RETURNABLE' && res3.message === 'This item is non-returnable' && res3.policy_name === 'Non Returnable', 'NON_RETURNABLE evaluated correctly.', res3);

  // Test 4: getReturnEligibility - WINDOW_EXPIRED
  console.log('\nAsserting WINDOW_EXPIRED eligibility...');
  let res4 = await getReturnEligibility(db, 9902, 99021); // Delivered 15 days ago, replacement window is 7 days
  expect(res4.status === 'WINDOW_EXPIRED' && res4.message.startsWith('Return window expired on'), 'WINDOW_EXPIRED evaluated correctly.', res4);

  // Test 5: getReturnEligibility - RETURN_ELIGIBLE
  console.log('\nAsserting RETURN_ELIGIBLE eligibility...');
  let res5 = await getReturnEligibility(db, 9901, 99011); // Delivered 2 days ago, return window is 30 days
  expect(res5.status === 'RETURN_ELIGIBLE' && res5.message.startsWith('Eligible for return until'), 'RETURN_ELIGIBLE evaluated correctly.', res5);

  // Test 6: getReturnEligibility - REPLACEMENT_ELIGIBLE
  console.log('\nAsserting REPLACEMENT_ELIGIBLE eligibility...');
  let res6 = await getReturnEligibility(db, 9901, 99021); // Delivered 2 days ago, replacement window is 7 days
  expect(res6.status === 'REPLACEMENT_ELIGIBLE' && res6.message.startsWith('Eligible for replacement until'), 'REPLACEMENT_ELIGIBLE evaluated correctly.', res6);


  // ─── Controller Integration Tests ───

  const mockRes = {
    statusCode: 200,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.data = data;
    }
  };

  // Test 7: Product Controller - getProduct exposes return_policy DTO
  console.log('\nAsserting getProduct return_policy DTO...');
  const prodCtrl = createProductController(db);
  await prodCtrl.getProduct({ params: { product_id: '9901' }, headers: {}, protocol: 'http', get: () => 'localhost:5000' }, mockRes);
  expect(
    mockRes.data && mockRes.data.return_policy && mockRes.data.return_policy.type === 'returnable' && mockRes.data.return_policy.days === 30 && mockRes.data.return_policy.message === '30 Day Returns',
    'getProduct return_policy DTO is correct.',
    mockRes.data
  );

  // Test 8: Product Controller - getProducts search exposes return_policy DTO
  console.log('\nAsserting getProducts search return_policy DTO...');
  await prodCtrl.getProducts({ query: { q: 'Laptop' }, headers: {}, protocol: 'http', get: () => 'localhost:5000' }, mockRes);
  if (mockRes.data && mockRes.data.items && mockRes.data.items.length > 0 && mockRes.data.items[0].return_policy) {
    const policy = mockRes.data.items[0].return_policy;
    expect(
      policy.type === 'returnable' && policy.days === 30 && policy.message === '30 Day Returns',
      'getProducts return_policy DTO is correct.',
      policy
    );
  } else {
    expect(false, 'getProducts search return_policy DTO is present.', mockRes.data);
  }

  // Test 9: Order Controller - getOrder items enriched with return_eligibility
  console.log('\nAsserting getOrder items enriched return_eligibility...');
  const orderCtrl = createOrderController(db);
  await orderCtrl.getOrder({ params: { id: 9901 }, userId: 999, role: 'user' }, mockRes);
  if (mockRes.data && mockRes.data.items && mockRes.data.items[0].return_eligibility) {
    const el = mockRes.data.items[0].return_eligibility;
    expect(el.status === 'RETURN_ELIGIBLE' && el.message.startsWith('Eligible for return until'), 'getOrder items successfully enriched with return_eligibility.', el);
  } else {
    expect(false, 'getOrder enrichment payload is present.', mockRes.data);
  }

  // Test 10: Order Controller - getItemEligibility standalone API endpoint
  console.log('\nAsserting getItemEligibility standalone endpoint...');
  await orderCtrl.getItemEligibility({ params: { id: 9901, variant_id: 99011 }, userId: 999, role: 'user' }, mockRes);
  expect(mockRes.data && mockRes.data.status === 'RETURN_ELIGIBLE' && mockRes.data.message.startsWith('Eligible for return until'), 'getItemEligibility standalone endpoint correct.', mockRes.data);

  // Test 11: Admin Controller - updateOrderStatus records delivered_at on transition to delivered
  console.log('\nAsserting delivered_at transitions...');
  const adminCtrl = createAdminController(db);
  // Insert order in pending status
  await db.run('INSERT INTO orders (order_id, user_id, order_number, status, total_amount, payment_status, payment_method, customer_name, customer_email, delivered_at) VALUES (9910, 999, "ORD-9910", "pending", 50, "paid", "CARD", "Test User", "test@user.com", NULL)');
  await adminCtrl.updateOrderStatus({ params: { id: 9910 }, body: { status: 'delivered' } }, mockRes);
  const updatedOrder = await db.get('SELECT status, delivered_at FROM orders WHERE order_id = 9910');
  expect(updatedOrder && updatedOrder.status === 'delivered' && updatedOrder.delivered_at, 'status transitioned to delivered and delivered_at timestamp recorded successfully.', updatedOrder);

  // Clean up
  await db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (failures.length > 0) {
    throw new Error(`Phase 5A verification failed with ${failures.length} issue(s): ${failures.join('; ')}`);
  }
  console.log('\nAll Phase 5A Returns Infrastructure tests run completed.');
}

runTests().catch(err => {
  console.error('Unhandled test run error:', err);
});
