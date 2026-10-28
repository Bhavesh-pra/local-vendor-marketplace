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
  console.log('Starting Phase 6D Supplier Performance Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_supplier_performance.sqlite');

  // Copy database file to avoid cluttering main db
  fs.copyFileSync(mainDbPath, testDbPath);

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  try {
    // 1. Clean and Setup Test Data
    await db.run('DELETE FROM users');
    await db.run('DELETE FROM purchase_orders');
    await db.run('DELETE FROM purchase_order_items');

    // Insert 2 Suppliers
    await db.run("INSERT INTO users (user_id, username, email, password_hash, role, status) VALUES (10, 'supplier_1', 's1@test.com', 'hash', 'supplier', 'active')");
    await db.run("INSERT INTO users (user_id, username, email, password_hash, role, status) VALUES (11, 'supplier_2', 's2@test.com', 'hash', 'supplier', 'active')");

    // Insert POs for Supplier 1 (user_id = 10)
    // PO 1: RECEIVED (Completed). Acknowledged in 2 hours, Delivered in 3 days.
    await db.run(`
      INSERT INTO purchase_orders (po_id, supplier_id, status, created_by, created_at, updated_at, sent_at, acknowledged_at, received_at)
      VALUES (101, 10, 'RECEIVED', 1, '2026-07-01 10:00:00', '2026-07-04 10:00:00', '2026-07-01 10:00:00', '2026-07-01 12:00:00', '2026-07-04 10:00:00')
    `);
    await db.run(`INSERT INTO purchase_order_items (po_item_id, po_id, variant_id, ordered_quantity, received_quantity) VALUES (201, 101, 1, 100, 100)`);

    // PO 2: CANCELLED
    await db.run(`
      INSERT INTO purchase_orders (po_id, supplier_id, status, created_by, created_at, updated_at, sent_at)
      VALUES (102, 10, 'CANCELLED', 1, '2026-07-02 10:00:00', '2026-07-02 12:00:00', '2026-07-02 10:00:00')
    `);
    await db.run(`INSERT INTO purchase_order_items (po_item_id, po_id, variant_id, ordered_quantity, received_quantity) VALUES (202, 102, 1, 50, 0)`);

    // PO 3: ACKNOWLEDGED (Active). Acknowledged in 4 hours.
    await db.run(`
      INSERT INTO purchase_orders (po_id, supplier_id, status, created_by, created_at, updated_at, sent_at, acknowledged_at)
      VALUES (103, 10, 'ACKNOWLEDGED', 1, '2026-07-03 10:00:00', '2026-07-03 14:00:00', '2026-07-03 10:00:00', '2026-07-03 14:00:00')
    `);
    await db.run(`INSERT INTO purchase_order_items (po_item_id, po_id, variant_id, ordered_quantity, received_quantity) VALUES (203, 103, 1, 80, 20)`);

    // 2. Run controller method
    const controller = createAdminController(db);
    const req = {};
    const res = mockResponse();

    await controller.getSupplierPerformance(req, res);

    // Validate Status and Payload
    const perfData = res.jsonData;
    if (!Array.isArray(perfData)) throw new Error('Expected response to be an array');
    
    // Find Supplier 1 Performance
    const s1 = perfData.find(p => p.supplier_id === 10);
    if (!s1) throw new Error('Supplier 1 performance data not found');

    console.log('Supplier 1 performance:', s1);

    // Assert values based on contract rules
    if (s1.total_purchase_orders !== 3) throw new Error(`Expected total_purchase_orders = 3, got ${s1.total_purchase_orders}`);
    if (s1.completed_purchase_orders !== 1) throw new Error(`Expected completed_purchase_orders = 1, got ${s1.completed_purchase_orders}`);
    if (s1.cancelled_purchase_orders !== 1) throw new Error(`Expected cancelled_purchase_orders = 1, got ${s1.cancelled_purchase_orders}`);
    if (s1.active_purchase_orders !== 1) throw new Error(`Expected active_purchase_orders = 1, got ${s1.active_purchase_orders}`);
    
    // Fulfillment rate = completed / total = 1 / 3 = 0.3333
    if (Math.abs(s1.fulfillment_rate - 0.3333) > 0.0001) throw new Error(`Expected fulfillment_rate = 0.3333, got ${s1.fulfillment_rate}`);

    // Quantity ordered = 100 + 50 + 80 = 230
    if (s1.quantity_ordered !== 230) throw new Error(`Expected quantity_ordered = 230, got ${s1.quantity_ordered}`);
    
    // Quantity received = 100 + 0 + 20 = 120
    if (s1.quantity_received !== 120) throw new Error(`Expected quantity_received = 120, got ${s1.quantity_received}`);

    // Fill rate = received / ordered = 120 / 230 = 0.5217
    if (Math.abs(s1.fill_rate - 0.5217) > 0.0001) throw new Error(`Expected fill_rate = 0.5217, got ${s1.fill_rate}`);

    // Averages:
    // Ack hours: PO 101: 2h, PO 103: 4h. Avg = (2+4)/2 = 3h.
    if (s1.average_ack_hours !== 3) throw new Error(`Expected average_ack_hours = 3, got ${s1.average_ack_hours}`);

    // Delivery days: PO 101: 3 days. Avg = 3 days.
    if (s1.average_delivery_days !== 3) throw new Error(`Expected average_delivery_days = 3, got ${s1.average_delivery_days}`);

    // Supplier 2 should have 0s or nulls
    const s2 = perfData.find(p => p.supplier_id === 11);
    if (!s2) throw new Error('Supplier 2 performance data not found');
    if (s2.total_purchase_orders !== 0) throw new Error('Expected 0 total POs for Supplier 2');
    if (s2.average_ack_hours !== null) throw new Error('Expected null average_ack_hours for Supplier 2');
    if (s2.average_delivery_days !== null) throw new Error('Expected null average_delivery_days for Supplier 2');

    console.log('SUCCESS: Supplier Performance metrics validated successfully.');
  } finally {
    await db.close();
    fs.unlinkSync(testDbPath);
  }
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
