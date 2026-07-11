const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { createProductController } = require('../controllers/productController');

async function runTests() {
  console.log('Starting Phase 4A Backend Tests in Isolation...');
  
  // Set JWT env for testing
  process.env.JWT_SECRET = 'TEST_SECRET';

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, '../test_ecommerce.sqlite');

  // Copy database file
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  // Re-run FTS5 initialization on test db
  await db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
      product_id UNINDEXED,
      product_name,
      short_description,
      description,
      brand,
      category_name
    )
  `);

  await db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_products_insert AFTER INSERT ON products
    BEGIN
      INSERT INTO products_fts(product_id, product_name, short_description, description, brand, category_name)
      VALUES (
        new.product_id,
        new.product_name,
        IFNULL(new.short_description, ''),
        new.description,
        IFNULL(new.brand, ''),
        IFNULL((SELECT category_name FROM categories WHERE category_id = new.category_id), '')
      );
    END;
  `);

  await db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_products_update AFTER UPDATE ON products
    BEGIN
      UPDATE products_fts
      SET product_name = new.product_name,
          short_description = IFNULL(new.short_description, ''),
          description = new.description,
          brand = IFNULL(new.brand, ''),
          category_name = IFNULL((SELECT category_name FROM categories WHERE category_id = new.category_id), '')
      WHERE product_id = old.product_id;
    END;
  `);

  await db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_products_delete AFTER DELETE ON products
    BEGIN
      DELETE FROM products_fts WHERE product_id = old.product_id;
    END;
  `);

  await db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_categories_update AFTER UPDATE OF category_name ON categories
    BEGIN
      UPDATE products_fts
      SET category_name = new.category_name
      WHERE product_id IN (SELECT product_id FROM products WHERE category_id = new.category_id);
    END;
  `);

  // Backfill FTS
  await db.run(`
    INSERT INTO products_fts(product_id, product_name, short_description, description, brand, category_name)
    SELECT p.product_id, p.product_name, IFNULL(p.short_description, ''), p.description, IFNULL(p.brand, ''), IFNULL(c.category_name, '')
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.category_id
    WHERE p.product_id NOT IN (SELECT product_id FROM products_fts)
  `);

  // Clean test products if they exist
  await db.run('DELETE FROM products WHERE product_name LIKE "TEST %"');
  await db.run('DELETE FROM products_fts WHERE product_name LIKE "TEST %"');

  // Insert dummy category
  await db.run('INSERT OR IGNORE INTO categories (category_id, category_name, category_slug) VALUES (99, "TEST Category", "test-category")');

  // 1. Test FTS Insert Trigger
  console.log('\nTesting FTS Insert Trigger...');
  await db.run(`
    INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price, product_status, brand, short_description)
    VALUES (9999, 1, 99, 'TEST Iphone 16 Plus Red', 'Brand new smartphone with A18 chip', 600, 799, 'active', 'Apple', '16 Plus Red')
  `);

  const ftsRow = await db.get('SELECT * FROM products_fts WHERE product_id = 9999');
  if (ftsRow && ftsRow.product_name === 'TEST Iphone 16 Plus Red') {
    console.log('SUCCESS: Insert trigger synchronized FTS5 index correctly.');
  } else {
    console.error('FAIL: Insert trigger failed. FTS Row:', ftsRow);
  }

  // 2. Test FTS Update Trigger
  console.log('\nTesting FTS Update Trigger...');
  await db.run("UPDATE products SET product_name = 'TEST Iphone 16 Plus Gold' WHERE product_id = 9999");
  const ftsRowUpdated = await db.get('SELECT * FROM products_fts WHERE product_id = 9999');
  if (ftsRowUpdated && ftsRowUpdated.product_name === 'TEST Iphone 16 Plus Gold') {
    console.log('SUCCESS: Update trigger synchronized FTS5 index correctly.');
  } else {
    console.error('FAIL: Update trigger failed. FTS Row:', ftsRowUpdated);
  }

  // 3. Test Search Controller with normalization & ranking
  console.log('\nTesting Search and Normalization Pipeline...');
  const mockReq = {
    query: { q: '  TEST Iphone & Gold! ' },
    protocol: 'http',
    get: () => 'localhost:3000'
  };
  
  let jsonResponse = null;
  const mockRes = {
    json: (data) => { jsonResponse = data; },
    status: () => mockRes
  };

  const controller = createProductController(db);
  await controller.getProducts(mockReq, mockRes);

  if (jsonResponse && jsonResponse.products && jsonResponse.products.length > 0 && jsonResponse.products[0].product_id === 9999) {
    console.log('SUCCESS: Search pipeline resolved normalization and retrieved product successfully.');
    console.log('Matching Search Score:', jsonResponse.products[0].search_score);
    console.log('Brands Facets Calculated:', jsonResponse.facets.brands);
  } else {
    console.error('FAIL: Search query did not match expected product. Results:', jsonResponse);
  }

  // 4. Test Suggestions Endpoint
  console.log('\nTesting Search Suggestions...');
  const sugReq = {
    query: { q: 'test iph' }
  };
  let sugResponse = null;
  const sugRes = {
    json: (data) => { sugResponse = data; }
  };

  await controller.getProductSuggestions(sugReq, sugRes);
  if (sugResponse && sugResponse.includes('TEST Iphone 16 Plus Gold')) {
    console.log('SUCCESS: Autocomplete suggestions returned prefix match successfully.');
    console.log('Suggestions:', sugResponse);
  } else {
    console.error('FAIL: Suggestions failed to match typed prefix. Suggestions:', sugResponse);
  }

  // Close connection
  await db.close();

  // Cleanup file
  fs.unlinkSync(testDbPath);
  console.log('\nTemporary test database cleaned up. All tests completed.');
}

runTests().catch(err => {
  console.error('Test Execution Error:', err);
});
