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
  console.log('Starting Phase 7 Analytics Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_analytics.sqlite');

  // Copy database file to avoid schema bootstrap
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
    await db.run('DELETE FROM categories');
    await db.run('DELETE FROM inventory');

    // Create category
    await db.run("INSERT INTO categories (category_id, category_name, category_slug) VALUES (1, 'Electronics', 'electronics')");

    // Create users (suppliers and customers)
    await db.run("INSERT INTO users (user_id, username, email, role, password_hash, status) VALUES (10, 'SupplierA', 'supa@test.com', 'supplier', '123', 'active')");
    await db.run("INSERT INTO users (user_id, username, email, role, password_hash, status) VALUES (100, 'CustomerA', 'custa@test.com', 'customer', '123', 'active')");
    await db.run("INSERT INTO users (user_id, username, email, role, password_hash, status) VALUES (101, 'CustomerB', 'custb@test.com', 'customer', '123', 'active')");

    // Create products (cost_price = 60, selling_price = 100 -> Gross Margin = 40%)
    await db.run("INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price, mrp, brand, slug) VALUES (1, 10, 1, 'Phone', 'Best Phone', 60, 100, 100, 'Apple', 'phone')");
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku) VALUES (1, 1, 'SKU-PHONE')");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, purchase_price) VALUES (1, 10, 50, 50)");

    // Create orders
    // Order 1: Customer A spends 100 (1 unit) on 2026-07-10 (completed/delivered)
    await db.run(`
      INSERT INTO orders (order_id, user_id, order_number, status, payment_method, payment_status, subtotal_amount, shipping_amount, tax_amount, total_amount, customer_name, customer_email, address_line_1, customer_phone, placed_at, delivered_at)
      VALUES (1, 100, 'ORD-001', 'delivered', 'COD', 'paid', 100, 0, 0, 100, 'Customer A', 'custa@test.com', 'Addr A', '1234', '2026-07-10 12:00:00', '2026-07-11 12:00:00')
    `);
    await db.run("INSERT INTO order_items (order_item_id, order_id, variant_id, supplier_id, quantity, unit_price, line_total) VALUES (1, 1, 1, 10, 1, 100, 100)");

    // Order 2: Customer A spends 200 (2 units) on 2026-07-12 (completed/delivered)
    await db.run(`
      INSERT INTO orders (order_id, user_id, order_number, status, payment_method, payment_status, subtotal_amount, shipping_amount, tax_amount, total_amount, customer_name, customer_email, address_line_1, customer_phone, placed_at, delivered_at)
      VALUES (2, 100, 'ORD-002', 'delivered', 'COD', 'paid', 200, 0, 0, 200, 'Customer A', 'custa@test.com', 'Addr A', '1234', '2026-07-12 12:00:00', '2026-07-13 12:00:00')
    `);
    await db.run("INSERT INTO order_items (order_item_id, order_id, variant_id, supplier_id, quantity, unit_price, line_total) VALUES (2, 2, 1, 10, 2, 100, 200)");

    // Order 3: Customer B spends 100 (1 unit) on 2026-07-14 (cancelled)
    await db.run(`
      INSERT INTO orders (order_id, user_id, order_number, status, payment_method, payment_status, subtotal_amount, shipping_amount, tax_amount, total_amount, customer_name, customer_email, address_line_1, customer_phone, placed_at)
      VALUES (3, 101, 'ORD-003', 'cancelled', 'COD', 'pending', 100, 0, 0, 100, 'Customer B', 'custb@test.com', 'Addr B', '1234', '2026-07-14 12:00:00')
    `);
    await db.run("INSERT INTO order_items (order_item_id, order_id, variant_id, supplier_id, quantity, unit_price, line_total) VALUES (3, 3, 1, 10, 1, 100, 100)");

    // Create telemetry events
    await db.run("INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, created_at) VALUES ('product_view', 100, 'session1', 1, 1, '2026-07-10 11:30:00')");
    await db.run("INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, created_at) VALUES ('add_to_cart', 100, 'session1', 1, 1, '2026-07-10 11:45:00')");
    await db.run("INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, created_at) VALUES ('checkout_started', 100, 'session1', 1, 1, '2026-07-10 11:50:00')");
    await db.run("INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, created_at) VALUES ('purchase_complete', 100, 'session1', 1, 1, '2026-07-10 12:00:00')");

    // Instantiation
    const controller = createAdminController(db);

    // 2. Validate Sales Analytics
    const salesRes = mockResponse();
    await controller.getSalesAnalytics({}, salesRes);
    const sales = salesRes.jsonData;
    
    if (sales.summary.total_revenue !== 300) throw new Error(`Expected revenue 300, got ${sales.summary.total_revenue}`);
    if (sales.summary.total_cogs !== 180) throw new Error(`Expected COGS 180, got ${sales.summary.total_cogs}`);
    if (sales.summary.gross_profit !== 120) throw new Error(`Expected profit 120, got ${sales.summary.gross_profit}`);
    if (sales.summary.gross_margin_pct !== 40) throw new Error(`Expected gross margin 40%, got ${sales.summary.gross_margin_pct}%`);
    if (sales.summary.aov !== 150) throw new Error(`Expected AOV 150, got ${sales.summary.aov}`);
    console.log('✔ Sales Analytics tests passed.');

    // 3. Validate Order Analytics
    const orderRes = mockResponse();
    await controller.getOrderAnalytics({}, orderRes);
    const orders = orderRes.jsonData;

    if (orders.statusCounts.delivered !== 2) throw new Error(`Expected 2 delivered orders, got ${orders.statusCounts.delivered}`);
    if (orders.statusCounts.cancelled !== 1) throw new Error(`Expected 1 cancelled orders, got ${orders.statusCounts.cancelled}`);
    if (orders.summary.success_rate !== (2/3)*100) throw new Error(`Expected success rate 66.7%, got ${orders.summary.success_rate}%`);
    console.log('✔ Order Analytics tests passed.');

    // 4. Validate Customer Analytics
    const customerRes = mockResponse();
    await controller.getCustomerAnalytics({}, customerRes);
    const customers = customerRes.jsonData;

    if (customers.summary.total_customers !== 2) throw new Error(`Expected 2 customers, got ${customers.summary.total_customers}`);
    if (customers.summary.clv !== 300) throw new Error(`Expected CLV 300, got ${customers.summary.clv}`);
    if (customers.summary.purchase_frequency !== 2) throw new Error(`Expected purchase frequency 2, got ${customers.summary.purchase_frequency}`);
    if (customers.summary.repeat_purchase_rate !== 50) throw new Error(`Expected repeat purchase rate 50%, got ${customers.summary.repeat_purchase_rate}`);
    // Customer retention math check
    if (customers.summary.retention_30 !== 100) throw new Error(`Expected 30d retention 100%, got ${customers.summary.retention_30}`);
    console.log('✔ Customer Analytics tests passed.');

    // 5. Validate Product Analytics
    const productRes = mockResponse();
    await controller.getProductAnalytics({}, productRes);
    const prods = productRes.jsonData.products;

    const prodInfo = prods.find(p => p.product_id === 1);
    if (!prodInfo) throw new Error('Test product not found in results');
    if (prodInfo.view_count !== 1) throw new Error(`Expected 1 product view, got ${prodInfo.view_count}`);
    // Sales units count is 3 (1 from ORD-001 + 2 from ORD-002; ORD-003 is cancelled)
    if (prodInfo.units_sold !== 3) throw new Error(`Expected 3 units sold, got ${prodInfo.units_sold}`);
    if (prodInfo.conversion_rate !== 300) throw new Error(`Expected conversion rate 300%, got ${prodInfo.conversion_rate}%`);
    console.log('✔ Product Analytics tests passed.');

    // 6. Validate Funnel Analytics
    const funnelRes = mockResponse();
    await controller.getFunnelAnalytics({}, funnelRes);
    const funs = funnelRes.jsonData.funnel;

    const viewStep = funs.find(f => f.step === 'Product Viewed');
    const purchaseStep = funs.find(f => f.step === 'Purchase Completed');
    if (viewStep.sessions !== 1) throw new Error(`Expected 1 session for View, got ${viewStep.sessions}`);
    if (purchaseStep.sessions !== 1) throw new Error(`Expected 1 session for Purchase, got ${purchaseStep.sessions}`);
    if (purchaseStep.overall_conversion_pct !== 100) throw new Error(`Expected overall conversion 100%, got ${purchaseStep.overall_conversion_pct}%`);
    console.log('✔ Funnel Analytics tests passed.');

    console.log('SUCCESS: All Phase 7 Business Intelligence and Analytics tests passed.');
  } finally {
    await db.close();
    fs.unlinkSync(testDbPath);
  }
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
