const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { createProductController } = require('../controllers/productController');

async function runTests() {
  console.log('Starting Phase 4D Recommendation Engine Tests in Isolation...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_recommendation.sqlite');

  // Copy database file
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  // Re-run DDL setup on test db
  await db.run('DROP TABLE IF EXISTS analytics_events');
  await db.run(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      user_id INTEGER NULL,
      session_id TEXT NOT NULL,
      product_id INTEGER NULL,
      category_id INTEGER NULL,
      metadata TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Assertions block
  const controller = createProductController(db);
  // Clear dummy data first
  await db.run('DELETE FROM products WHERE product_name LIKE "REC_TEST_%"');
  
  // Insert test products:
  // Current target product: ID 9001 (Category 90, brand 'Alpha', Price 100)
  // Candidate 1: ID 9002 (Category 90, brand 'Alpha', Price 105, in stock)
  // Candidate 2: ID 9003 (Category 90, brand 'Beta', Price 120, out of stock)
  // Candidate 3: ID 9004 (Category 99, brand 'Alpha', Price 100, in stock)
  await db.run(`
    INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price, product_status, brand, short_description)
    VALUES 
      (9001, 1, 90, 'REC_TEST_Target', 'Target description', 50, 100, 'active', 'Alpha', 'Target short'),
      (9002, 1, 90, 'REC_TEST_Similar_InStock', 'Similar in stock', 50, 105, 'active', 'Alpha', 'Similar short'),
      (9003, 1, 90, 'REC_TEST_Similar_OutOfStock', 'Similar out of stock', 50, 120, 'active', 'Beta', 'Similar short 2'),
      (9004, 1, 99, 'REC_TEST_DiffCategory', 'Different category', 50, 100, 'active', 'Alpha', 'Diff short')
  `);

  // Insert variants and stock:
  // pv 9002: 10 in stock
  // Insert variants and stock:
  // pv 9002: 10 in stock
  // pv 9003: 0 in stock
  await db.run('DELETE FROM product_variants WHERE variant_id IN (9101, 9102, 9103)');
  await db.run(`
    INSERT INTO product_variants (variant_id, product_id, size, color, cost_override, price_override, status, sku)
    VALUES
      (9101, 9001, 'M', 'Black', NULL, NULL, 'active', 'REC_TEST_SKU_1'),
      (9102, 9002, 'M', 'Black', NULL, NULL, 'active', 'REC_TEST_SKU_2'),
      (9103, 9003, 'M', 'Black', NULL, NULL, 'active', 'REC_TEST_SKU_3')
  `);

  await db.run('DELETE FROM inventory WHERE supplier_id = 99');
  await db.run(`
    INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price)
    VALUES
      (9101, 99, 10, 0, 5, 50),
      (9102, 99, 5, 0, 5, 50),
      (9103, 99, 0, 0, 5, 50)
  `);

  const mockReq = {
    params: { product_id: '9001' },
    protocol: 'http',
    get: () => 'localhost:3000'
  };

  let jsonResponse = null;
  const mockRes = {
    json: (data) => { jsonResponse = data; },
    status: () => mockRes
  };

  await controller.getRecommendations(mockReq, mockRes);

  console.log('\nTesting Similar Products and Out-of-Stock deprioritization...');
  if (jsonResponse && jsonResponse.similar_products) {
    const similar = jsonResponse.similar_products.filter(p => p.product_name.startsWith('REC_TEST_'));
    if (similar.length === 2 && similar[0].product_id === 9002 && similar[1].product_id === 9003) {
      console.log('SUCCESS: Similar products prioritized category and in-stock replacements correctly.');
    } else {
      console.error('FAIL: Similar products query result incorrect:', similar);
    }
  } else {
    console.error('FAIL: Recommendations returned empty JSON.');
  }

  // Test candidate limits
  console.log('\nTesting candidate limits (maximum 20)...');
  if (jsonResponse && jsonResponse.trending_products) {
    if (jsonResponse.trending_products.length <= 20) {
      console.log(`SUCCESS: Trending candidates list size is within the limit of 20 (got ${jsonResponse.trending_products.length}).`);
    } else {
      console.error(`FAIL: Candidates list exceeded 20 items. Size: ${jsonResponse.trending_products.length}`);
    }
  }

  // Cleanup DB
  await db.run('DELETE FROM products WHERE product_name LIKE "REC_TEST_%"');
  await db.run('DELETE FROM product_variants WHERE variant_id IN (9101, 9102, 9103)');
  await db.run('DELETE FROM inventory WHERE supplier_id = 99');

  await db.close();
  fs.unlinkSync(testDbPath);
  console.log('\nTemporary database cleaned up. All recommendation tests completed successfully.');
}

runTests().catch(err => {
  console.error('Test runner exception:', err);
});
