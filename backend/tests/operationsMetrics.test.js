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
  console.log('Starting Phase 6F Operations & Optimization Metrics Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_operations_metrics.sqlite');

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
    await db.run('DELETE FROM returns');
    await db.run('DELETE FROM inventory_movements');

    // Create a product
    await db.run("INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price, mrp, brand, slug) VALUES (1, 1, 1, 'Ops Test Product', 'Desc', 50, 100, 100, 'Brand', 'ops-test-product')");

    // Variant 1: FAST_MOVING
    // Current stock: 10. Net change 90d: +5. Reconstructed: 5. Avg inventory: 7.5. Units sold 90d: 45. Turnover: 6.0.
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku) VALUES (1, 1, 'SKU-FAST')");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price) VALUES (1, 1, 10, 0, 5, 50)");
    
    // Log movements in last 90 days for variant 1
    await db.run("INSERT INTO inventory_movements (variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, created_at) VALUES (1, 1, 'SUPPLIER_RESTOCK', 50, 0, 50, datetime('now', '-10 days'))");
    await db.run("INSERT INTO inventory_movements (variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, created_at) VALUES (1, 1, 'ORDER_SALE', -45, 50, 5, datetime('now', '-5 days'))");
    // Extra adjustment to reach current stock of 10
    await db.run("INSERT INTO inventory_movements (variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, created_at) VALUES (1, 1, 'RETURN_RESTOCK', 5, 5, 10, datetime('now', '-2 days'))");
    
    // Variant 2: SLOW_MOVING
    // Current stock: 100. Net change 90d: -5. Reconstructed: 105. Avg inventory: 102.5. Units sold 90d: 5. Turnover: 5/102.5 = 0.048.
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku) VALUES (2, 1, 'SKU-SLOW')");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price) VALUES (2, 1, 100, 0, 5, 50)");
    await db.run("INSERT INTO inventory_movements (variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, created_at) VALUES (2, 1, 'ORDER_SALE', -5, 105, 100, datetime('now', '-15 days'))");

    // Variant 3: HIGH_RETURN_RATE
    // Sold: 10 units. Returned: 3 units. Return rate: 3/10 = 30%.
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku) VALUES (3, 1, 'SKU-HIGHRETURN')");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price) VALUES (3, 1, 10, 0, 5, 50)");
    
    // Add Sales for units_sold_90d and sold_units calculations
    const now = new Date();
    const date10d = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '); // 10 days ago

    // Order for Variant 1 (45 units)
    await db.run(`INSERT INTO orders (order_id, order_number, user_id, status, total_amount, payment_status, payment_method, customer_name, customer_email, placed_at) VALUES (1, 'ORD-0001', 1, 'delivered', 4500, 'paid', 'CARD', 'Test User', 'test@user.com', '${date10d}')`);
    await db.run(`INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (1, 1, 1, 45, 100, 4500, 1)`);

    // Order for Variant 2 (5 units)
    await db.run(`INSERT INTO orders (order_id, order_number, user_id, status, total_amount, payment_status, payment_method, customer_name, customer_email, placed_at) VALUES (2, 'ORD-0002', 1, 'delivered', 500, 'paid', 'CARD', 'Test User', 'test@user.com', '${date10d}')`);
    await db.run(`INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (2, 2, 2, 5, 100, 500, 1)`);

    // Order for Variant 3 (10 units)
    await db.run(`INSERT INTO orders (order_id, order_number, user_id, status, total_amount, payment_status, payment_method, customer_name, customer_email, placed_at) VALUES (3, 'ORD-0003', 1, 'delivered', 1000, 'paid', 'CARD', 'Test User', 'test@user.com', '${date10d}')`);

    // Add returns for Variant 3 (order_item_id = 3, variant_id = 3, quantity = 10, return of 3 units)
    // Note that returned_units is calculated by joining returns and order_items and summing oi.quantity.
    // If order_item 3 has quantity 10, joining returns with order_item 3 sums 10 units per return!
    // To match 3 returned units, we simulate a return record pointing to order_item 3.
    // Wait, let's look at returned_units query: `SELECT SUM(oi.quantity) FROM returns ret JOIN order_items oi ON ret.order_item_id = oi.order_item_id WHERE ret.variant_id = pv.variant_id`.
    // Since order_items quantity is 10, a return record joined with it will return 10!
    // Wait, if order_items quantity is 10, and we want return rate to be 30%, let's make sure sold_units = 10 and returned_units = 3.
    // Wait! How can returned_units be 3 if order_items has quantity 10?
    // If the return is per item line, the whole item line is returned (10 units).
    // Or we could have an order item of quantity 3, and another of quantity 7 (total sold = 10), and return only the order item of quantity 3!
    // Yes! Let's insert two separate order items for Variant 3:
    // - Order item 3a: quantity 3, which gets returned.
    // - Order item 3b: quantity 7, which is NOT returned.
    // This is incredibly smart! Let's do that:
    await db.run(`INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (3, 3, 3, 3, 100, 300, 1)`);
    await db.run(`INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (4, 3, 3, 7, 100, 700, 1)`);

    // Insert Return pointing to order_item_id = 3 (Variant 3)
    await db.run(`
      INSERT INTO returns (return_id, order_id, order_item_id, variant_id, user_id, request_type, reason_code, status, created_at)
      VALUES (1, 3, 3, 3, 1, 'return', 'QUALITY_ISSUE', 'REFUND_COMPLETED', '${date10d}')
    `);

    // 2. Run controller method
    const controller = createAdminController(db);
    const req = {};
    const res = mockResponse();

    await controller.getOperationsMetrics(req, res);

    // Validate
    const opData = res.jsonData;
    if (!Array.isArray(opData)) throw new Error('Expected response to be an array');

    // 1. Check SKU-FAST
    const vFast = opData.find(o => o.sku === 'SKU-FAST');
    if (!vFast) throw new Error('FAST variant not found');
    console.log('FAST variant:', vFast);
    // current_stock = 10
    // net_change = 50 - 45 + 5 = 10. Wait!
    // Let's trace our net_change insert statements for Variant 1:
    // im 1: +50
    // im 2: -45
    // im 3: +5 (RETURN_RESTOCK)
    // Net change = 50 - 45 + 5 = +10.
    // Reconstructed 90d = 10 - 10 = 0.
    // Avg inventory = (10 + 0) / 2 = 5.
    // Units sold 90d = 45.
    // Turnover = 45 / 5 = 9.0. (which is > 2.0, so FAST_MOVING!)
    if (vFast.inventory_turnover !== 9.0) throw new Error(`Expected turnover = 9.0, got ${vFast.inventory_turnover}`);
    if (!vFast.flags.includes('FAST_MOVING')) throw new Error('Expected FAST_MOVING flag');

    // 2. Check SKU-SLOW
    const vSlow = opData.find(o => o.sku === 'SKU-SLOW');
    if (!vSlow) throw new Error('SLOW variant not found');
    console.log('SLOW variant:', vSlow);
    // current_stock = 100.
    // net_change = -5.
    // Reconstructed = 100 - (-5) = 105.
    // Avg inventory = (100 + 105) / 2 = 102.5.
    // Units sold 90d = 5.
    // Turnover = 5 / 102.5 = 0.0488.
    if (Math.abs(vSlow.inventory_turnover - 0.0488) > 0.0001) throw new Error(`Expected turnover = 0.0488, got ${vSlow.inventory_turnover}`);
    if (!vSlow.flags.includes('SLOW_MOVING')) throw new Error('Expected SLOW_MOVING flag');

    // 3. Check SKU-HIGHRETURN
    const vReturn = opData.find(o => o.sku === 'SKU-HIGHRETURN');
    if (!vReturn) throw new Error('HIGHRETURN variant not found');
    console.log('HIGHRETURN variant:', vReturn);
    // Sold: 3 + 7 = 10 units.
    // Returned: 3 units.
    // Return rate: 3 / 10 = 0.3 (30.0%)
    if (vReturn.return_rate !== 0.3) throw new Error(`Expected return_rate = 0.3, got ${vReturn.return_rate}`);
    if (!vReturn.flags.includes('HIGH_RETURN_RATE')) throw new Error('Expected HIGH_RETURN_RATE flag');

    // Sell Through Rate for Variant 3: sold_units / (sold_units + current_stock) = 10 / (10 + 10) = 0.5 (50.0%)
    if (vReturn.sell_through_rate !== 0.5) throw new Error(`Expected sell_through_rate = 0.5, got ${vReturn.sell_through_rate}`);

    console.log('SUCCESS: Operations & Optimization metrics and flags validated successfully.');
  } finally {
    await db.close();
    fs.unlinkSync(testDbPath);
  }
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
