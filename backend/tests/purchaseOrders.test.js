const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { isTransitionAllowed, getAllowedActions } = require('../services/purchaseOrderStateMachine');
const { createPurchaseOrderController } = require('../controllers/purchaseOrderController');

// Helper to create mock request and response
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
  console.log('Starting Phase 6C Purchase Orders & Supplier Procurement Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_purchase_orders.sqlite');

  // Copy database file to avoid cluttering main db
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  try {
    // ─── 1. SETUP CLEAN STATE ───
    await db.run('DELETE FROM inventory_movements');
    await db.run('DELETE FROM inventory');
    await db.run('DELETE FROM product_variants');
    await db.run('DELETE FROM products');
    await db.run('DELETE FROM users');
    await db.run('DELETE FROM purchase_orders');
    await db.run('DELETE FROM purchase_order_items');

    // Seed test users: admin (1), supplier A (2), supplier B (3)
    await db.run("INSERT INTO users (user_id, username, email, password_hash, role, status) VALUES (1, 'admin', 'admin@test.com', 'hash', 'admin', 'active')");
    await db.run("INSERT INTO users (user_id, username, email, password_hash, role, status) VALUES (2, 'supplierA', 'supplierA@test.com', 'hash', 'supplier', 'active')");
    await db.run("INSERT INTO users (user_id, username, email, password_hash, role, status) VALUES (3, 'supplierB', 'supplierB@test.com', 'hash', 'supplier', 'active')");

    // Seed products & variants
    await db.run("INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price, mrp, brand, slug) VALUES (1, 2, 1, 'Prod 1', 'Desc 1', 50, 100, 100, 'Brand A', 'prod-1')");
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku, size, color, is_default) VALUES (10, 1, 'SKU-10', 'M', 'Black', 1)");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price) VALUES (10, 2, 5, 0, 5, 50)");

    console.log('Setup and Seeding completed successfully.');

    const controller = createPurchaseOrderController(db);

    // ─── Test 1: State Machine Transitions ───
    console.log('\n--- TEST 1: STATE MACHINE TRANSITIONS ---');
    // Valid transitions
    if (!isTransitionAllowed('DRAFT', 'SENT')) throw new Error('DRAFT -> SENT should be allowed');
    if (!isTransitionAllowed('SENT', 'ACKNOWLEDGED')) throw new Error('SENT -> ACKNOWLEDGED should be allowed');
    if (!isTransitionAllowed('ACKNOWLEDGED', 'PARTIALLY_RECEIVED')) throw new Error('ACKNOWLEDGED -> PARTIALLY_RECEIVED should be allowed');
    if (!isTransitionAllowed('ACKNOWLEDGED', 'RECEIVED')) throw new Error('ACKNOWLEDGED -> RECEIVED should be allowed');
    if (!isTransitionAllowed('PARTIALLY_RECEIVED', 'RECEIVED')) throw new Error('PARTIALLY_RECEIVED -> RECEIVED should be allowed');
    if (!isTransitionAllowed('DRAFT', 'CANCELLED')) throw new Error('DRAFT -> CANCELLED should be allowed');
    if (!isTransitionAllowed('SENT', 'CANCELLED')) throw new Error('SENT -> CANCELLED should be allowed');
    if (!isTransitionAllowed('ACKNOWLEDGED', 'CANCELLED')) throw new Error('ACKNOWLEDGED -> CANCELLED should be allowed');

    // Forbidden transitions
    if (isTransitionAllowed('RECEIVED', 'DRAFT')) throw new Error('RECEIVED -> DRAFT should be forbidden');
    if (isTransitionAllowed('CANCELLED', 'DRAFT')) throw new Error('CANCELLED -> DRAFT should be forbidden');
    if (isTransitionAllowed('PARTIALLY_RECEIVED', 'SENT')) throw new Error('PARTIALLY_RECEIVED -> SENT should be forbidden');
    console.log('SUCCESS: State machine transitions validated!');

    // ─── Test 2: Supplier Visibility ───
    console.log('\n--- TEST 2: SUPPLIER VISIBILITY & ACCESS BOUNDARIES ---');
    // Create a PO for Supplier A (2)
    const poResult = await db.run(`
      INSERT INTO purchase_orders (supplier_id, status, notes, created_by, created_at, updated_at)
      VALUES (2, 'SENT', 'PO for supplier A', 1, datetime('now'), datetime('now'))
    `);
    const poId = poResult.lastID;

    // Supplier A accesses details (Allowed)
    const reqA = { params: { id: poId }, userId: 2, role: 'supplier' };
    const resA = mockResponse();
    await controller.getSupplierPurchaseOrderDetails(reqA, resA);
    if (resA.statusCode === 403) throw new Error('Supplier A should have access to own PO');
    if (resA.jsonData.supplier_id !== 2) throw new Error('Expected supplier_id to be 2');

    // Supplier B accesses Supplier A's PO (Forbidden)
    const reqB = { params: { id: poId }, userId: 3, role: 'supplier' };
    const resB = mockResponse();
    await controller.getSupplierPurchaseOrderDetails(reqB, resB);
    if (resB.statusCode !== 403) throw new Error('Supplier B should be blocked from accessing Supplier A PO');
    console.log('SUCCESS: Supplier boundaries validated successfully!');

    // ─── Test 3: Partial and Full Receiving Flow ───
    console.log('\n--- TEST 3: PARTIAL AND FULL RECEIVING WORKFLOW ---');
    // Set up PO with ordered qty = 100
    const poReceiveRes = await db.run(`
      INSERT INTO purchase_orders (supplier_id, status, notes, created_by, created_at, updated_at)
      VALUES (2, 'ACKNOWLEDGED', 'Receiving PO', 1, datetime('now'), datetime('now'))
    `);
    const poReceiveId = poReceiveRes.lastID;
    await db.run(`
      INSERT INTO purchase_order_items (po_id, variant_id, ordered_quantity, received_quantity, unit_cost, created_at)
      VALUES (?, 10, 100, 0, 45.0, datetime('now'))
    `, [poReceiveId]);

    // Initial stock is 5
    let stockInfo = await db.get('SELECT available_stock FROM inventory WHERE variant_id = 10');
    if (stockInfo.available_stock !== 5) throw new Error('Initial stock expected to be 5');

    // Step 3a: Receive partial quantity of 40
    const reqReceive1 = {
      params: { id: poReceiveId },
      userId: 1,
      body: {
        items: [{ variant_id: 10, quantity: 40 }],
        notes: 'First batch of 40'
      }
    };
    const resReceive1 = mockResponse();
    await controller.receivePurchaseOrderInventory(reqReceive1, resReceive1);

    // Verify PO status is PARTIALLY_RECEIVED
    const poStatus1 = await db.get('SELECT status FROM purchase_orders WHERE po_id = ?', [poReceiveId]);
    if (poStatus1.status !== 'PARTIALLY_RECEIVED') throw new Error(`Expected status PARTIALLY_RECEIVED, got ${poStatus1.status}`);

    // Verify line item received_quantity is 40
    const poItem1 = await db.get('SELECT received_quantity FROM purchase_order_items WHERE po_id = ? AND variant_id = 10', [poReceiveId]);
    if (poItem1.received_quantity !== 40) throw new Error(`Expected received quantity 40, got ${poItem1.received_quantity}`);

    // Verify stock is 45 (5 + 40)
    stockInfo = await db.get('SELECT available_stock FROM inventory WHERE variant_id = 10');
    if (stockInfo.available_stock !== 45) throw new Error(`Expected stock 45, got ${stockInfo.available_stock}`);

    // Verify inventory movement logged
    const move1 = await db.get('SELECT * FROM inventory_movements WHERE variant_id = 10 ORDER BY created_at DESC, movement_id DESC LIMIT 1');
    if (move1.movement_type !== 'SUPPLIER_RESTOCK') throw new Error(`Expected movement type SUPPLIER_RESTOCK, got ${move1.movement_type}`);
    if (move1.quantity_change !== 40) throw new Error(`Expected change +40, got ${move1.quantity_change}`);

    // Step 3b: Receive remaining 60
    const reqReceive2 = {
      params: { id: poReceiveId },
      userId: 1,
      body: {
        items: [{ variant_id: 10, quantity: 60 }],
        notes: 'Second final batch of 60'
      }
    };
    const resReceive2 = mockResponse();
    await controller.receivePurchaseOrderInventory(reqReceive2, resReceive2);

    // Verify PO status is RECEIVED
    const poStatus2 = await db.get('SELECT status FROM purchase_orders WHERE po_id = ?', [poReceiveId]);
    if (poStatus2.status !== 'RECEIVED') throw new Error(`Expected status RECEIVED, got ${poStatus2.status}`);

    // Verify line item received_quantity is 100
    const poItem2 = await db.get('SELECT received_quantity FROM purchase_order_items WHERE po_id = ? AND variant_id = 10', [poReceiveId]);
    if (poItem2.received_quantity !== 100) throw new Error(`Expected received quantity 100, got ${poItem2.received_quantity}`);

    // Verify stock is 105 (45 + 60)
    stockInfo = await db.get('SELECT available_stock FROM inventory WHERE variant_id = 10');
    if (stockInfo.available_stock !== 105) throw new Error(`Expected stock 105, got ${stockInfo.available_stock}`);
    console.log('SUCCESS: Partial and full receiving workflows verified!');

    // ─── Test 4: Over-receiving validation & rollback ───
    console.log('\n--- TEST 4: OVER-RECEIVING VALIDATION & TRANSACTION ROLLBACK ---');
    const poOverRes = await db.run(`
      INSERT INTO purchase_orders (supplier_id, status, notes, created_by, created_at, updated_at)
      VALUES (2, 'ACKNOWLEDGED', 'Over-receiving PO', 1, datetime('now'), datetime('now'))
    `);
    const poOverId = poOverRes.lastID;
    await db.run(`
      INSERT INTO purchase_order_items (po_id, variant_id, ordered_quantity, received_quantity, unit_cost, created_at)
      VALUES (?, 10, 50, 0, 45.0, datetime('now'))
    `, [poOverId]);

    // Initial stock is 105
    stockInfo = await db.get('SELECT available_stock FROM inventory WHERE variant_id = 10');
    const initialStockBeforeOver = stockInfo.available_stock;

    // Try to receive 60 (exceeds ordered_quantity of 50)
    const reqOver = {
      params: { id: poOverId },
      userId: 1,
      body: {
        items: [{ variant_id: 10, quantity: 60 }],
        notes: 'Over-receiving batch'
      }
    };
    const resOver = mockResponse();
    await controller.receivePurchaseOrderInventory(reqOver, resOver);

    // Expecting 400 Bad Request
    if (resOver.statusCode !== 400) throw new Error(`Expected HTTP 400, got ${resOver.statusCode}`);

    // Verify stock is unchanged (transaction rollback)
    stockInfo = await db.get('SELECT available_stock FROM inventory WHERE variant_id = 10');
    if (stockInfo.available_stock !== initialStockBeforeOver) {
      throw new Error(`Expected stock to remain unchanged at ${initialStockBeforeOver}, but got ${stockInfo.available_stock}`);
    }

    // Verify received_quantity is still 0
    const overItem = await db.get('SELECT received_quantity FROM purchase_order_items WHERE po_id = ? AND variant_id = 10', [poOverId]);
    if (overItem.received_quantity !== 0) throw new Error(`Expected received quantity to remain 0, got ${overItem.received_quantity}`);
    console.log('SUCCESS: Over-receiving validation and transaction rollback verified!');

    // ─── Test 5: Cancellation Rules ───
    console.log('\n--- TEST 5: CANCELLATION STATE MACHINE RULES ---');
    // Draft -> Cancelled (Allowed)
    const poCancel1 = await db.run("INSERT INTO purchase_orders (supplier_id, status, created_by) VALUES (2, 'DRAFT', 1)");
    const resC1 = mockResponse();
    await controller.updatePurchaseOrderStatus({ params: { id: poCancel1.lastID }, body: { status: 'CANCELLED' } }, resC1);
    if (resC1.statusCode === 400) throw new Error('Cancellation from DRAFT should be allowed');

    // Sent -> Cancelled (Allowed)
    const poCancel2 = await db.run("INSERT INTO purchase_orders (supplier_id, status, created_by) VALUES (2, 'SENT', 1)");
    const resC2 = mockResponse();
    await controller.updatePurchaseOrderStatus({ params: { id: poCancel2.lastID }, body: { status: 'CANCELLED' } }, resC2);
    if (resC2.statusCode === 400) throw new Error('Cancellation from SENT should be allowed');

    // Acknowledged -> Cancelled (Allowed)
    const poCancel3 = await db.run("INSERT INTO purchase_orders (supplier_id, status, created_by) VALUES (2, 'ACKNOWLEDGED', 1)");
    const resC3 = mockResponse();
    await controller.updatePurchaseOrderStatus({ params: { id: poCancel3.lastID }, body: { status: 'CANCELLED' } }, resC3);
    if (resC3.statusCode === 400) throw new Error('Cancellation from ACKNOWLEDGED should be allowed');

    // Partially Received -> Cancelled (Rejected)
    const poCancel4 = await db.run("INSERT INTO purchase_orders (supplier_id, status, created_by) VALUES (2, 'PARTIALLY_RECEIVED', 1)");
    const resC4 = mockResponse();
    await controller.updatePurchaseOrderStatus({ params: { id: poCancel4.lastID }, body: { status: 'CANCELLED' } }, resC4);
    if (resC4.statusCode !== 400) throw new Error('Cancellation from PARTIALLY_RECEIVED should be blocked');

    // Received -> Cancelled (Rejected)
    const poCancel5 = await db.run("INSERT INTO purchase_orders (supplier_id, status, created_by) VALUES (2, 'RECEIVED', 1)");
    const resC5 = mockResponse();
    await controller.updatePurchaseOrderStatus({ params: { id: poCancel5.lastID }, body: { status: 'CANCELLED' } }, resC5);
    if (resC5.statusCode !== 400) throw new Error('Cancellation from RECEIVED should be blocked');

    console.log('SUCCESS: Cancellation rules validated successfully!');

  } finally {
    await db.close();
    // Cleanup test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }

  console.log('\nALL PHASE 6C PURCHASE ORDER TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err.stack || err.message);
  process.exit(1);
});
