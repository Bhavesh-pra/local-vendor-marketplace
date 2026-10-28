const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { createAdminController } = require('../controllers/adminController');

const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

async function runTests() {
  console.log('Starting Phase 6E Inventory Forecasting Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_forecasting.sqlite');

  // Copy database file to avoid cluttering main db
  fs.copyFileSync(mainDbPath, testDbPath);

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  try {
    // 1. Clean and Setup Test Data
    await db.run('DELETE FROM products');
    await db.run('DELETE FROM product_variants');
    await db.run('DELETE FROM inventory');
    await db.run('DELETE FROM orders');
    await db.run('DELETE FROM order_items');

    // Create a product and 5 variants (representing the 5 risk buckets)
    await db.run("INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price, mrp, brand, slug) VALUES (1, 1, 1, 'Test Product', 'Desc', 50, 100, 100, 'Brand', 'test-product')");
    
    // Variant 1: NO_SALES_HISTORY (0 sales)
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku) VALUES (1, 1, 'SKU-NOSALES')");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price) VALUES (1, 1, 10, 0, 5, 50)");

    // Variant 2: CRITICAL (Stock = 5, Daily Avg = 1.0 -> Days of Inv = 5 < 7)
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku) VALUES (2, 1, 'SKU-CRITICAL')");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price) VALUES (2, 1, 5, 0, 5, 50)");

    // Variant 3: LOW (Stock = 15, Daily Avg = 1.0 -> Days of Inv = 15 < 21)
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku) VALUES (3, 1, 'SKU-LOW')");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price) VALUES (3, 1, 15, 0, 5, 50)");

    // Variant 4: HEALTHY (Stock = 45, Daily Avg = 1.0 -> Days of Inv = 45 between 21 and 90)
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku) VALUES (4, 1, 'SKU-HEALTHY')");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price) VALUES (4, 1, 45, 0, 5, 50)");

    // Variant 5: OVERSTOCKED (Stock = 120, Daily Avg = 1.0 -> Days of Inv = 120 > 90)
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku) VALUES (5, 1, 'SKU-OVERSTOCKED')");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price) VALUES (5, 1, 120, 0, 5, 50)");

    // Add Sales (orders with status = 'delivered')
    // We want 30 units sold in the last 30 days for variants 2, 3, 4, 5.
    // Let's place them: 5 units in the last 7 days, 25 units in the remaining last 30 days.
    const now = new Date();
    const date7d = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '); // 2 days ago
    const date30d = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '); // 15 days ago
    const date90d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '); // 60 days ago

    // Insert Order 1 (2 days ago, status = 'delivered')
    await db.run(`INSERT INTO orders (order_id, order_number, user_id, status, total_amount, payment_status, payment_method, customer_name, customer_email, placed_at) VALUES (1, 'ORD-0001', 1, 'delivered', 400, 'paid', 'CARD', 'Test User', 'test@user.com', '${date7d}')`);
    for (let vId = 2; vId <= 5; vId++) {
      await db.run(`INSERT INTO order_items (order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (1, ${vId}, 5, 100, 500, 1)`);
    }

    // Insert Order 2 (15 days ago, status = 'delivered')
    await db.run(`INSERT INTO orders (order_id, order_number, user_id, status, total_amount, payment_status, payment_method, customer_name, customer_email, placed_at) VALUES (2, 'ORD-0002', 1, 'delivered', 2000, 'paid', 'CARD', 'Test User', 'test@user.com', '${date30d}')`);
    for (let vId = 2; vId <= 5; vId++) {
      await db.run(`INSERT INTO order_items (order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (2, ${vId}, 25, 100, 2500, 1)`);
    }

    // Insert Order 3 (60 days ago, status = 'delivered')
    await db.run(`INSERT INTO orders (order_id, order_number, user_id, status, total_amount, payment_status, payment_method, customer_name, customer_email, placed_at) VALUES (3, 'ORD-0003', 1, 'delivered', 800, 'paid', 'CARD', 'Test User', 'test@user.com', '${date90d}')`);
    for (let vId = 2; vId <= 5; vId++) {
      await db.run(`INSERT INTO order_items (order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (3, ${vId}, 10, 100, 1000, 1)`);
    }

    // 2. Run controller method
    const controller = createAdminController(db);
    const req = {};
    const res = mockResponse();

    await controller.getInventoryForecast(req, res);

    // Validate
    const forecastData = res.jsonData;
    if (!Array.isArray(forecastData)) throw new Error('Expected response to be an array');

    // 1. Check SKU-NOSALES
    const vNoSales = forecastData.find(f => f.sku === 'SKU-NOSALES');
    if (!vNoSales) throw new Error('NO SALES variant not found');
    if (vNoSales.sales_last_7_days !== 0) throw new Error('Expected 0 sales for NO SALES variant');
    if (vNoSales.average_daily_sales_30d !== 0) throw new Error('Expected 0 average daily sales');
    if (vNoSales.days_of_inventory !== null) throw new Error('Expected null days of inventory');
    if (vNoSales.risk_bucket !== 'NO_SALES_HISTORY') throw new Error(`Expected NO_SALES_HISTORY risk bucket, got ${vNoSales.risk_bucket}`);

    // 2. Check SKU-CRITICAL
    const vCritical = forecastData.find(f => f.sku === 'SKU-CRITICAL');
    if (!vCritical) throw new Error('CRITICAL variant not found');
    // Sales 7d = 5, 30d = 30, 90d = 40.
    if (vCritical.sales_last_7_days !== 5) throw new Error(`Expected sales 7d = 5, got ${vCritical.sales_last_7_days}`);
    if (vCritical.sales_last_30_days !== 30) throw new Error(`Expected sales 30d = 30, got ${vCritical.sales_last_30_days}`);
    if (vCritical.sales_last_90_days !== 40) throw new Error(`Expected sales 90d = 40, got ${vCritical.sales_last_90_days}`);
    // Daily Avg 30d = 30 / 30.0 = 1.0
    if (vCritical.average_daily_sales_30d !== 1.0) throw new Error(`Expected daily avg = 1.0, got ${vCritical.average_daily_sales_30d}`);
    // Days of Inventory = current_stock / daily avg = 5 / 1.0 = 5 days
    if (vCritical.days_of_inventory !== 5) throw new Error(`Expected days of inventory = 5, got ${vCritical.days_of_inventory}`);
    if (vCritical.risk_bucket !== 'CRITICAL') throw new Error(`Expected CRITICAL risk bucket, got ${vCritical.risk_bucket}`);

    // 3. Check SKU-LOW
    const vLow = forecastData.find(f => f.sku === 'SKU-LOW');
    if (vLow.days_of_inventory !== 15) throw new Error('Expected days of inventory = 15');
    if (vLow.risk_bucket !== 'LOW') throw new Error(`Expected LOW risk bucket, got ${vLow.risk_bucket}`);

    // 4. Check SKU-HEALTHY
    const vHealthy = forecastData.find(f => f.sku === 'SKU-HEALTHY');
    if (vHealthy.days_of_inventory !== 45) throw new Error('Expected days of inventory = 45');
    if (vHealthy.risk_bucket !== 'HEALTHY') throw new Error(`Expected HEALTHY risk bucket, got ${vHealthy.risk_bucket}`);

    // 5. Check SKU-OVERSTOCKED
    const vOver = forecastData.find(f => f.sku === 'SKU-OVERSTOCKED');
    if (vOver.days_of_inventory !== 120) throw new Error('Expected days of inventory = 120');
    if (vOver.risk_bucket !== 'OVERSTOCKED') throw new Error(`Expected OVERSTOCKED risk bucket, got ${vOver.risk_bucket}`);

    console.log('SUCCESS: Inventory Forecasting metrics and risk buckets validated successfully.');
  } finally {
    await db.close();
    fs.unlinkSync(testDbPath);
  }
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
