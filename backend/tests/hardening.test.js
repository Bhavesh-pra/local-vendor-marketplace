const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { createReviewController } = require('../controllers/reviewController');
const { createProductController } = require('../controllers/productController');
const { createAnalyticsController } = require('../controllers/analyticsController');

async function runTests() {
  console.log('Starting Phase 4 Hardening Refinements Verification Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_hardening.sqlite');

  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  const reviewCtrl = createReviewController(db);
  const prodCtrl = createProductController(db);
  const analyticsCtrl = createAnalyticsController(db);

  const mockRes = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.data = data;
    }
  };

  // Mock users & reviews
  await db.run('DELETE FROM reviews WHERE product_id = 9999');
  await db.run('DELETE FROM users WHERE user_id IN (9999, 9998, 9997, 9996)');

  await db.run(`INSERT INTO users (user_id, username, email, password_hash) VALUES (9999, 'test_user_99', 'test99@refine.com', 'hash')`);
  await db.run(`INSERT INTO users (user_id, username, email, password_hash) VALUES (9998, 'test_user_98', 'test98@refine.com', 'hash')`);
  await db.run(`INSERT INTO users (user_id, username, email, password_hash) VALUES (9997, 'test_user_97', 'test97@refine.com', 'hash')`);
  await db.run(`INSERT INTO users (user_id, username, email, password_hash) VALUES (9996, 'test_user_96', 'test96@refine.com', 'hash')`);

  await db.run(`
    INSERT INTO reviews (review_id, product_id, user_id, rating, comment, created_at)
    VALUES 
      (9991, 9999, 9999, 5, 'Great review 1', '2026-07-01 10:00:00'),
      (9992, 9999, 9998, 4, 'Great review 2', '2026-07-02 10:00:00'),
      (9993, 9999, 9997, 3, 'Great review 3', '2026-07-03 10:00:00'),
      (9994, 9999, 9996, 2, 'Great review 4', '2026-07-04 10:00:00')
  `);

  // ─── Test 1: Reviews Pagination ───
  console.log('\nTesting Reviews Pagination Contract...');
  await reviewCtrl.getReviews({
    params: { product_id: 9999 },
    query: { page: 2, limit: 2 }
  }, mockRes);

  const resp = mockRes.data;
  if (resp && Array.isArray(resp.reviews) && resp.total_count === 4 && resp.reviews.length === 2 && resp.has_next === false) {
    console.log('SUCCESS: Reviews pagination contract returned unified structure correctly.');
  } else {
    console.error('FAIL: Reviews pagination response invalid:', resp);
  }

  // ─── Test 2: Search items Metadata ───
  console.log('\nTesting Search items Response Contract...');
  // Insert active dummy products
  await db.run('DELETE FROM products WHERE product_id IN (9991, 9992)');
  await db.run(`
    INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price, product_status, brand, short_description)
    VALUES 
      (9991, 1, 2, 'TEST_Refinement product 1', 'Desc 1', 10, 20, 'active', 'RefineBrand', 'Short 1'),
      (9992, 1, 2, 'TEST_Refinement product 2', 'Desc 2', 15, 30, 'active', 'RefineBrand', 'Short 2')
  `);

  // Rebuild cache
  if (global.clearSearchVocabularyCache) {
    global.clearSearchVocabularyCache();
  }

  await prodCtrl.getProducts({
    query: { brand: 'RefineBrand', page: 1, limit: 10 },
    protocol: 'http',
    get: () => 'localhost:3000'
  }, mockRes);

  const prodResp = mockRes.data;
  if (prodResp && Array.isArray(prodResp.items) && prodResp.total_count === 2 && !prodResp.products) {
    console.log('SUCCESS: Product search metadata returned items array and total_count successfully.');
  } else {
    console.error('FAIL: Product search response mismatch:', prodResp);
  }

  // ─── Test 3: Server Derived Telemetry User Identity ───
  console.log('\nTesting Server Derived User Identity...');
  await db.run('DELETE FROM analytics_events WHERE session_id = "test_sess_refine"');

  // Trigger telemetry log event with req.userId set by middleware mock, ignoring body user_id
  await analyticsCtrl.logEvent({
    body: {
      event_name: 'product_view',
      user_id: 1234, // spoofed client user_id
      session_id: 'test_sess_refine',
      product_id: 9991,
      category_id: 2
    },
    userId: 9999 // Server authenticated userId
  }, mockRes);

  // Fetch the created event to verify user_id matched server value
  const event = await db.get('SELECT user_id FROM analytics_events WHERE session_id = "test_sess_refine"');
  if (event && event.user_id === 9999) {
    console.log('SUCCESS: Analytics event wrote server-derived user ID, successfully ignoring spoofed client user ID.');
  } else {
    console.error('FAIL: Analytics event user ID mismatch. Got:', event);
  }

  // Cleanup
  await db.run('DELETE FROM reviews WHERE product_id = 9999');
  await db.run('DELETE FROM users WHERE user_id = 9999');
  await db.run('DELETE FROM products WHERE product_id IN (9991, 9992)');
  await db.run('DELETE FROM analytics_events WHERE session_id = "test_sess_refine"');

  await db.close();
  fs.unlinkSync(testDbPath);
  console.log('\nHardening verification tests completed.');
}

runTests().catch(err => {
  console.error('Hardening test runner error:', err);
});
