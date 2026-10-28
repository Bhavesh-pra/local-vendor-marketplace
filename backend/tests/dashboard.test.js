const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { createAdminController } = require('../controllers/adminController');

async function runTests() {
  console.log('Starting Phase 6A Dashboard Stats Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_dashboard.sqlite');

  // Copy database file to avoid cluttering main db
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  try {
    // ─── 1. SETUP CLEAN STATE ───
    await db.run('DELETE FROM returns');
    await db.run('DELETE FROM reviews');
    await db.run('DELETE FROM order_items');
    await db.run('DELETE FROM orders');
    await db.run('DELETE FROM inventory');
    await db.run('DELETE FROM product_variants');
    await db.run('DELETE FROM products');
    await db.run('DELETE FROM categories');

    // ─── 2. SEED CATEGORY AND PRODUCTS ───
    await db.run("INSERT INTO categories (category_id, category_name, category_slug, is_active) VALUES (1, 'Electronics', 'electronics', 1)");

    // Seed 4 products
    // P1: Target for best seller
    // P2: Target for low stock / highest rated
    // P3: Target for out of stock
    // P4: Target for worst seller (0 sales)
    await db.run(`
      INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price, mrp, product_status, brand, slug)
      VALUES 
        (1, 1, 1, 'Prod 1', 'Desc 1', 50, 100, 100, 'active', 'Brand A', 'prod-1'),
        (2, 1, 1, 'Prod 2', 'Desc 2', 40, 80, 80, 'active', 'Brand B', 'prod-2'),
        (3, 1, 1, 'Prod 3', 'Desc 3', 30, 60, 60, 'active', 'Brand C', 'prod-3'),
        (4, 1, 1, 'Prod 4', 'Desc 4', 20, 40, 40, 'active', 'Brand D', 'prod-4')
    `);

    // Seed product variants (one per product)
    await db.run(`
      INSERT INTO product_variants (variant_id, product_id, sku, size, color, price_override, cost_override, is_default, status)
      VALUES
        (1, 1, 'SKU-1', 'M', 'Black', 100, 50, 1, 'active'),
        (2, 2, 'SKU-2', 'M', 'Black', 80, 40, 1, 'active'),
        (3, 3, 'SKU-3', 'M', 'Black', 60, 30, 1, 'active'),
        (4, 4, 'SKU-4', 'M', 'Black', 40, 20, 1, 'active')
    `);

    // Seed inventory stock levels
    // P1: Stock = 100 (in stock)
    // P2: Stock = 5 (low stock: <= 10)
    // P3: Stock = 0 (out of stock)
    // P4: Stock = 20 (in stock)
    await db.run(`
      INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price)
      VALUES
        (1, 1, 100, 0, 5, 50),
        (2, 1, 5, 0, 5, 40),
        (3, 1, 0, 0, 5, 30),
        (4, 1, 20, 0, 5, 20)
    `);

    // ─── 3. SEED ORDERS ───
    // Order O1: Delivered (Today) -> Total 100
    // Order O2: Delivered (3 days ago) -> Total 80
    // Order O3: Cancelled -> Total 60
    // Order O4: Returned -> Total 60
    // Order O5: Pending (Today)
    // Order O6: Shipped (Today)
    const todayStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const threeDaysAgoStr = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    await db.run(`
      INSERT INTO orders (order_id, user_id, order_number, status, payment_method, payment_status, total_amount, customer_name, customer_email, placed_at)
      VALUES
        (1, 1, 'ORD-001', 'delivered', 'UPI', 'paid', 100.0, 'Cust 1', 'cust1@test.com', '${todayStr}'),
        (2, 1, 'ORD-002', 'delivered', 'UPI', 'paid', 80.0, 'Cust 2', 'cust2@test.com', '${threeDaysAgoStr}'),
        (3, 1, 'ORD-003', 'cancelled', 'UPI', 'paid', 60.0, 'Cust 3', 'cust3@test.com', '${todayStr}'),
        (4, 1, 'ORD-004', 'returned', 'UPI', 'paid', 60.0, 'Cust 4', 'cust4@test.com', '${todayStr}'),
        (5, 1, 'ORD-005', 'pending', 'UPI', 'pending', 50.0, 'Cust 5', 'cust5@test.com', '${todayStr}'),
        (6, 1, 'ORD-006', 'shipped', 'UPI', 'paid', 110.0, 'Cust 6', 'cust6@test.com', '${todayStr}')
    `);

    // Seed order items
    // O1: Product 1 (delivered)
    // O2: Product 2 (delivered)
    // O3: Product 3 (cancelled)
    // O4: Product 3 (returned)
    // O5: Product 1 (pending)
    // O6: Product 2 (shipped)
    await db.run(`
      INSERT INTO order_items (order_item_id, order_id, variant_id, supplier_id, quantity, unit_price, line_total)
      VALUES
        (1, 1, 1, 1, 1, 100.0, 100.0),
        (2, 2, 2, 1, 1, 80.0, 80.0),
        (3, 3, 3, 1, 1, 60.0, 60.0),
        (4, 4, 3, 1, 1, 60.0, 60.0),
        (5, 5, 1, 1, 1, 50.0, 50.0),
        (6, 6, 2, 1, 1, 110.0, 110.0)
    `);

    // ─── 4. SEED REVIEWS & RETURNS ───
    // Add reviews for Product 2 (Highest Rated)
    await db.run(`
      INSERT INTO reviews (review_id, product_id, user_id, rating, comment, order_item_id)
      VALUES
        (1, 2, 1, 5, 'Awesome prod!', 2)
    `);

    // Add returns
    // R1: REQUESTED for O4
    // R2: REJECTED
    // R3: REFUND_COMPLETED
    // R4: APPROVED
    await db.run(`
      INSERT INTO returns (return_id, order_id, order_item_id, variant_id, user_id, request_type, reason_code, status)
      VALUES
        (1, 4, 4, 3, 1, 'return', 'DAMAGED_ITEM', 'REQUESTED'),
        (2, 1, 1, 1, 1, 'return', 'DAMAGED_ITEM', 'REJECTED'),
        (3, 1, 1, 1, 1, 'return', 'DAMAGED_ITEM', 'REFUND_COMPLETED'),
        (4, 1, 1, 1, 1, 'return', 'DAMAGED_ITEM', 'APPROVED')
    `);

    // ─── 5. EXECUTE ENDPOINT CONTROLLER ───
    const controller = createAdminController(db);
    const mockReq = {
      role: 'admin',
      userId: 1
    };

    let jsonResponse = null;
    let responseStatus = 200;
    const mockRes = {
      status: (code) => {
        responseStatus = code;
        return mockRes;
      },
      json: (data) => {
        jsonResponse = data;
      }
    };

    await controller.getDashboardStats(mockReq, mockRes);

    // Verify response
    if (responseStatus !== 200) {
      throw new Error(`Controller returned status code ${responseStatus}`);
    }

    const { revenue, orders, inventory, products, returns } = jsonResponse;

    console.log('\n--- VERIFYING REVENUE METRICS ---');
    console.log('revenue:', revenue);
    if (revenue.total_revenue !== 180) throw new Error(`Incorrect total_revenue: expected 180, got ${revenue.total_revenue}`);
    if (revenue.revenue_today !== 100) throw new Error(`Incorrect revenue_today: expected 100, got ${revenue.revenue_today}`);
    if (revenue.average_order_value !== 90) throw new Error(`Incorrect average_order_value: expected 90, got ${revenue.average_order_value}`);
    console.log('SUCCESS: Revenue metrics match perfectly!');

    console.log('\n--- VERIFYING ORDER METRICS ---');
    console.log('orders:', orders);
    if (orders.orders_today !== 5) throw new Error(`Incorrect orders_today: expected 5, got ${orders.orders_today}`);
    if (orders.pending_orders !== 1) throw new Error(`Incorrect pending_orders: expected 1, got ${orders.pending_orders}`);
    if (orders.shipped_orders !== 1) throw new Error(`Incorrect shipped_orders: expected 1, got ${orders.shipped_orders}`);
    if (orders.delivered_orders !== 2) throw new Error(`Incorrect delivered_orders: expected 2, got ${orders.delivered_orders}`);
    if (orders.cancelled_orders !== 1) throw new Error(`Incorrect cancelled_orders: expected 1, got ${orders.cancelled_orders}`);
    console.log('SUCCESS: Order metrics match perfectly!');

    console.log('\n--- VERIFYING INVENTORY METRICS ---');
    console.log('inventory:', inventory);
    if (inventory.low_stock_products !== 1) throw new Error(`Incorrect low_stock_products: expected 1, got ${inventory.low_stock_products}`);
    if (inventory.out_of_stock_products !== 1) throw new Error(`Incorrect out_of_stock_products: expected 1, got ${inventory.out_of_stock_products}`);
    if (inventory.total_products !== 4) throw new Error(`Incorrect total_products: expected 4, got ${inventory.total_products}`);
    if (inventory.active_products !== 4) throw new Error(`Incorrect active_products: expected 4, got ${inventory.active_products}`);
    if (inventory.inactive_products !== 0) throw new Error(`Incorrect inactive_products: expected 0, got ${inventory.inactive_products}`);
    console.log('SUCCESS: Inventory metrics match perfectly!');

    console.log('\n--- VERIFYING RETURN METRICS ---');
    console.log('returns:', returns);
    if (returns.active_returns !== 2) throw new Error(`Incorrect active_returns: expected 2, got ${returns.active_returns}`);
    if (returns.pending_returns !== 1) throw new Error(`Incorrect pending_returns: expected 1, got ${returns.pending_returns}`);
    if (returns.approved_returns !== 1) throw new Error(`Incorrect approved_returns: expected 1, got ${returns.approved_returns}`);
    if (returns.completed_returns !== 1) throw new Error(`Incorrect completed_returns: expected 1, got ${returns.completed_returns}`);
    if (returns.rejected_returns !== 1) throw new Error(`Incorrect rejected_returns: expected 1, got ${returns.rejected_returns}`);
    console.log('SUCCESS: Return metrics match perfectly!');

    console.log('\n--- VERIFYING PRODUCT METRICS ---');
    console.log('products:', products);
    if (products.best_selling_products.length !== 2) throw new Error(`Incorrect best_selling_products count: expected 2, got ${products.best_selling_products.length}`);
    const worstSellerIds = products.worst_selling_products.map(p => p.id);
    if (!worstSellerIds.includes(4)) throw new Error(`P4 (zero sales) must be in worst_selling_products`);
    if (!worstSellerIds.includes(3)) throw new Error(`P3 (zero sales) must be in worst_selling_products`);
    console.log('SUCCESS: Product performance metrics match perfectly!');

    console.log('\nALL TESTS PASSED SUCCESSFULLY!');
  } finally {
    await db.close();
    // Delete test database file
    fs.unlinkSync(testDbPath);
    console.log('Cleaned up test database file.');
  }
}

runTests().catch(err => {
  console.error('TEST FAIL:', err);
  process.exit(1);
});
