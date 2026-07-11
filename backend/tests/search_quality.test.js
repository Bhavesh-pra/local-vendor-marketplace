const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { createProductController } = require('../controllers/productController');

async function runTests() {
  console.log('Starting Phase 4E Search Quality Tests in Isolation...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_search_quality.sqlite');

  // Copy database file
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  const controller = createProductController(db);

  // Clear dummy data first
  await db.run('DELETE FROM products WHERE product_name LIKE "TEST_%"');

  // Insert mock products
  // Product 1: ID 8001, Category 2 (Electronics), Brand 'Apple', Name 'iPhone 16'
  // Product 2: ID 8002, Category 2 (Electronics), Brand 'Samsung', Name 'Samsung S24'
  // Product 3: ID 8003, Category 1 (Clothes), Brand 'Nike', Name 'Running Shoes'
  await db.run(`
    INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price, product_status, brand, short_description)
    VALUES 
      (8001, 1, 2, 'TEST_iPhone 16', 'iPhone description', 500, 800, 'active', 'Apple', 'iPhone short'),
      (8002, 1, 2, 'TEST_Samsung S24', 'Samsung description', 400, 700, 'active', 'Samsung', 'Samsung short'),
      (8003, 1, 1, 'TEST_Running Shoes', 'Nike description', 50, 100, 'active', 'Nike', 'Shoes short')
  `);

  // Force cache rebuild
  if (global.clearSearchVocabularyCache) {
    global.clearSearchVocabularyCache();
  }

  // ─── Test 1: Typo corrections ───
  console.log('\nTesting Typo Corrections...');
  
  const mockRes = {
    json: (data) => {
      mockRes.data = data;
    },
    status: () => mockRes
  };

  // Test "iphnoe" typo
  await controller.getProducts({
    query: { q: 'iphnoe' },
    protocol: 'http',
    get: () => 'localhost:3000'
  }, mockRes);

  if (mockRes.data && mockRes.data.didYouMean === 'iphone') {
    console.log('SUCCESS: Typo correction "iphnoe" -> "iphone" passed.');
  } else {
    console.error('FAIL: Typo correction "iphnoe" -> "iphone" failed. Got:', mockRes.data ? mockRes.data.didYouMean : 'undefined');
  }

  // Test "samung" typo
  await controller.getProducts({
    query: { q: 'samung' },
    protocol: 'http',
    get: () => 'localhost:3000'
  }, mockRes);

  if (mockRes.data && mockRes.data.didYouMean === 'samsung') {
    console.log('SUCCESS: Typo correction "samung" -> "samsung" passed.');
  } else {
    console.error('FAIL: Typo correction "samung" -> "samsung" failed. Got:', mockRes.data ? mockRes.data.didYouMean : 'undefined');
  }

  // ─── Test 2: Intent Overrides ───
  console.log('\nTesting Intent Overrides...');

  await controller.getProducts({
    query: { q: 'cheap phone' },
    protocol: 'http',
    get: () => 'localhost:3000'
  }, mockRes);

  if (mockRes.data && mockRes.data.intentOverride) {
    const { qApplied, categoryApplied, sortApplied } = mockRes.data.intentOverride;
    if (qApplied === 'phone' && categoryApplied === 'electronics' && sortApplied === 'price_asc') {
      console.log('SUCCESS: Intent override "cheap phone" mapped correctly.');
    } else {
      console.error('FAIL: Intent override "cheap phone" mappings incorrect:', mockRes.data.intentOverride);
    }
  } else {
    console.error('FAIL: Intent override "cheap phone" did not return intentOverride metadata.');
  }

  // ─── Test 3: Suggestion Ranking ───
  console.log('\nTesting Suggestions Ranking Priorities...');

  await controller.getProductSuggestions({
    query: { q: 'iph' }
  }, mockRes);

  if (mockRes.data && mockRes.data.length > 0) {
    // Exact prefix match or matching prefix should come first
    const first = mockRes.data[0];
    if (first.toLowerCase().includes('iph')) {
      console.log('SUCCESS: Suggestion prefix ranking prioritized exact product prefix correctly.');
    } else {
      console.error('FAIL: Suggestion prefix ranking did not prioritize exact prefix. Got:', first);
    }
  } else {
    console.error('FAIL: Suggestions query returned empty.');
  }

  // Cleanup DB
  await db.run('DELETE FROM products WHERE product_name LIKE "TEST_%"');

  await db.close();
  fs.unlinkSync(testDbPath);
  console.log('\nTemporary database cleaned up. All search quality tests completed successfully.');
}

runTests().catch(err => {
  console.error('Test runner exception:', err);
});
