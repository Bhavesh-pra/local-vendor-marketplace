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
  console.log('Starting Phase 7 Supplier Analytics Isolation Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_supplier_analytics.sqlite');

  // Copy database file
  fs.copyFileSync(mainDbPath, testDbPath);

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  try {
    // 1. Clean and Setup Test Data
    await db.run('DELETE FROM users');
    await db.run('DELETE FROM products');
    await db.run('DELETE FROM product_variants');
    await db.run('DELETE FROM orders');
    await db.run('DELETE FROM order_items');
    await db.run('DELETE FROM analytics_events');
    await db.run('DELETE FROM inventory');

    // Create suppliers
    await db.run("INSERT INTO users (user_id, username, email, role, password_hash, status) VALUES (10, 'SupplierA', 'supa@test.com', 'supplier', '123', 'active')");
    await db.run("INSERT INTO users (user_id, username, email, role, password_hash, status) VALUES (20, 'SupplierB', 'supb@test.com', 'supplier', '123', 'active')");

    // Create products (Supplier A: ID 1, Supplier B: ID 2)
    await db.run("INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price) VALUES (1, 10, 1, 'Phone A', 'Desc A', 50, 100)");
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku) VALUES (1, 1, 'SKU-A')");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, purchase_price) VALUES (1, 10, 3, 50)"); // Low stock for A

    await db.run("INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price) VALUES (2, 20, 1, 'Phone B', 'Desc B', 60, 120)");
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku) VALUES (2, 2, 'SKU-B')");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, purchase_price) VALUES (2, 20, 10, 60)"); // Healthy stock for B

    // Order 1: Supplier A sale (total 100)
    await db.run(`
      INSERT INTO orders (order_id, user_id, order_number, status, payment_method, payment_status, subtotal_amount, shipping_amount, tax_amount, total_amount, customer_name, customer_email, address_line_1, customer_phone, placed_at)
      VALUES (1, 100, 'ORD-001', 'delivered', 'COD', 'paid', 100, 0, 0, 100, 'Customer A', 'custa@test.com', 'Addr A', '1234', '2026-07-10 12:00:00')
    `);
    await db.run("INSERT INTO order_items (order_item_id, order_id, variant_id, supplier_id, quantity, unit_price, line_total) VALUES (1, 1, 1, 10, 1, 100, 100)");

    // Order 2: Supplier B sale (total 120)
    await db.run(`
      INSERT INTO orders (order_id, user_id, order_number, status, payment_method, payment_status, subtotal_amount, shipping_amount, tax_amount, total_amount, customer_name, customer_email, address_line_1, customer_phone, placed_at)
      VALUES (2, 100, 'ORD-002', 'delivered', 'COD', 'paid', 120, 0, 0, 120, 'Customer A', 'custa@test.com', 'Addr A', '1234', '2026-07-12 12:00:00')
    `);
    await db.run("INSERT INTO order_items (order_item_id, order_id, variant_id, supplier_id, quantity, unit_price, line_total) VALUES (2, 2, 2, 20, 1, 120, 120)");

    // Seed view events (Supplier A: 5 views, Supplier B: 2 views)
    for (let i = 0; i < 5; i++) {
      await db.run(`INSERT INTO analytics_events (event_name, session_id, product_id, created_at) VALUES ('product_view', 'sess-${i}', 1, '2026-07-10 10:00:00')`);
    }
    for (let i = 0; i < 2; i++) {
      await db.run(`INSERT INTO analytics_events (event_name, session_id, product_id, created_at) VALUES ('product_view', 'sess-b-${i}', 2, '2026-07-10 10:00:00')`);
    }

    const controller = createAdminController(db);

    // 2. Test isolation for Supplier A
    const reqA = { role: 'supplier', userId: 10, query: {} };
    const resA = mockResponse();
    await controller.getSupplierAnalytics(reqA, resA);
    const dataA = resA.jsonData;

    if (dataA.summary.revenue !== 100) throw new Error(`Supplier A expected revenue 100, got ${dataA.summary.revenue}`);
    if (dataA.lowStock.length !== 1 || dataA.lowStock[0].sku !== 'SKU-A') {
      throw new Error(`Supplier A expected 1 low stock item (SKU-A), got ${dataA.lowStock.length}`);
    }
    const convA = dataA.conversionRates.find(c => c.product_id === 1);
    if (convA.views !== 5 || convA.sales !== 1 || convA.conversion_rate !== 20) {
      throw new Error(`Supplier A conversion rate expected 20%, got ${convA.conversion_rate}%`);
    }
    // Verify Supplier A cannot see Supplier B's product
    if (dataA.conversionRates.some(c => c.product_id === 2)) {
      throw new Error('Supplier A leakage: product 2 found in conversion data!');
    }
    console.log('✔ Supplier A isolated metrics validated.');

    // 3. Test isolation for Supplier B
    const reqB = { role: 'supplier', userId: 20, query: {} };
    const resB = mockResponse();
    await controller.getSupplierAnalytics(reqB, resB);
    const dataB = resB.jsonData;

    if (dataB.summary.revenue !== 120) throw new Error(`Supplier B expected revenue 120, got ${dataB.summary.revenue}`);
    if (dataB.lowStock.length !== 0) throw new Error(`Supplier B expected 0 low stock items, got ${dataB.lowStock.length}`);
    const convB = dataB.conversionRates.find(c => c.product_id === 2);
    if (convB.views !== 2 || convB.sales !== 1 || convB.conversion_rate !== 50) {
      throw new Error(`Supplier B conversion rate expected 50%, got ${convB.conversion_rate}%`);
    }
    if (dataB.conversionRates.some(c => c.product_id === 1)) {
      throw new Error('Supplier B leakage: product 1 found in conversion data!');
    }
    console.log('✔ Supplier B isolated metrics validated.');

    // 4. Test admin query options (no filter)
    const reqAdmin = { role: 'admin', query: {} };
    const resAdmin = mockResponse();
    await controller.getSupplierAnalytics(reqAdmin, resAdmin);
    const dataAdmin = resAdmin.jsonData;

    // Admin should see combined revenue = 220
    if (dataAdmin.summary.revenue !== 220) throw new Error(`Admin expected total revenue 220, got ${dataAdmin.summary.revenue}`);
    if (dataAdmin.conversionRates.length !== 2) throw new Error(`Admin expected 2 products in conversion list, got ${dataAdmin.conversionRates.length}`);
    console.log('✔ Admin comprehensive metrics validated.');

    // 5. Test admin query with supplier_id filter
    const reqAdminFilter = { role: 'admin', query: { supplier_id: 10 } };
    const resAdminFilter = mockResponse();
    await controller.getSupplierAnalytics(reqAdminFilter, resAdminFilter);
    const dataAdminFilter = resAdminFilter.jsonData;

    if (dataAdminFilter.summary.revenue !== 100) throw new Error(`Admin filter expected revenue 100, got ${dataAdminFilter.summary.revenue}`);
    console.log('✔ Admin parameterized supplier filtering validated.');

    console.log('SUCCESS: All supplier role-based isolation analytics boundaries checked.');
  } finally {
    await db.close();
    fs.unlinkSync(testDbPath);
  }
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
