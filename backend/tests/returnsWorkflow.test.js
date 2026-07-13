const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { getReturnEligibility } = require('../services/returnEligibility');
const { createReturnController } = require('../controllers/returnController');
const { isTransitionAllowed, getAllowedActions, getStepIndex } = require('../services/returnStateMachine');

async function runTests() {
  console.log('Starting Phase 5B Returns Workflow Engine Verification Tests...');
  const failures = [];
  const expect = (condition, message, details) => {
    if (condition) {
      console.log(`SUCCESS: ${message}`);
      return;
    }
    failures.push(message);
    console.error(`FAIL: ${message}`, details ?? '');
  };

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_returns_workflow.sqlite');

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  // Ensure returns and return_events tables exist in the test db
  await db.run(`
    CREATE TABLE IF NOT EXISTS returns (
      return_id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id           INTEGER NOT NULL,
      order_item_id      INTEGER NOT NULL,
      variant_id         INTEGER NOT NULL,
      user_id            INTEGER NOT NULL,
      request_type       TEXT NOT NULL CHECK (request_type IN ('return', 'replacement')),
      reason_code        TEXT NOT NULL CHECK (reason_code IN ('DAMAGED_ITEM', 'WRONG_ITEM_RECEIVED', 'MISSING_PARTS', 'NOT_AS_DESCRIBED', 'QUALITY_ISSUE', 'SIZE_ISSUE', 'CHANGED_MIND', 'OTHER')),
      reason_description TEXT,
      status             TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REFUNDED', 'REPLACEMENT_SHIPPED', 'REFUND_COMPLETED', 'REPLACEMENT_COMPLETED')),
      admin_notes        TEXT,
      requested_at       TEXT,
      approved_at        TEXT,
      rejected_at        TEXT,
      completed_at       TEXT,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS return_events (
      event_id         INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id        INTEGER NOT NULL,
      previous_status  TEXT,
      new_status       TEXT NOT NULL,
      actor_user_id    INTEGER,
      actor_type       TEXT NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system')),
      notes            TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Clear return test data
  await db.run('DELETE FROM returns');
  await db.run('DELETE FROM return_events');

  // Re-create the unique active index guard
  await db.run(`DROP INDEX IF EXISTS idx_returns_active_unique`);
  await db.run(`
    CREATE UNIQUE INDEX idx_returns_active_unique
    ON returns(order_id, variant_id)
    WHERE status <> 'REJECTED'
    AND status <> 'REFUND_COMPLETED'
    AND status <> 'REPLACEMENT_COMPLETED'
  `);

  // Mock response object
  const mockRes = {
    statusCode: 200,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.data = data;
    }
  };

  // Setup mock category, product, supplier, variant, and order
  await db.run('INSERT OR IGNORE INTO categories (category_id, category_name, category_slug) VALUES (999, "Electronics", "electronics")');
  await db.run('INSERT OR IGNORE INTO suppliers (supplier_id, supplier_name) VALUES (1, "Supplier1")');
  
  // Seed policies
  await db.run(`
    INSERT OR REPLACE INTO return_policies (policy_id, name, type, days) VALUES
      (3, 'Returnable 30 Days', 'returnable', 30),
      (4, 'Replacement Only 7 Days', 'replacement_only', 7)
  `);

  await db.run(`
    INSERT OR REPLACE INTO products (product_id, supplier_id, category_id, product_name, brand, selling_price, cost_price, mrp, product_status, return_policy_id, slug, description) VALUES
      (9901, 1, 999, 'Returnable Laptop', 'BrandX', 1000, 800, 1200, 'active', 3, 'ret-lap', 'laptop desc'),
      (9902, 1, 999, 'Replacement Phone', 'BrandY', 500, 400, 600, 'active', 4, 'rep-pho', 'phone desc')
  `);

  await db.run(`
    INSERT OR REPLACE INTO product_variants (variant_id, product_id, sku, size, color, price_override, cost_override, mrp_override, status) VALUES
      (99011, 9901, 'SKU-99011', '16GB', 'Silver', 1000, 800, 1200, 'active'),
      (99021, 9902, 'SKU-99021', '128GB', 'Black', 500, 400, 600, 'active')
  `);

  // Delivered orders
  const deliveredRecent = new Date();
  deliveredRecent.setDate(deliveredRecent.getDate() - 2);
  
  await db.run('DELETE FROM orders WHERE order_id >= 9900');
  await db.run('DELETE FROM order_items WHERE order_id >= 9900');

  await db.run(
    'INSERT INTO orders (order_id, user_id, order_number, status, total_amount, payment_status, payment_method, customer_name, customer_email, delivered_at) VALUES (9901, 999, "ORD-9901", "delivered", 1000, "paid", "CARD", "Test User", "test@user.com", ?)',
    [deliveredRecent.toISOString()]
  );
  await db.run(
    'INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (99011, 9901, 99011, 1, 1000, 1000, 1)'
  );

  await db.run(
    'INSERT INTO orders (order_id, user_id, order_number, status, total_amount, payment_status, payment_method, customer_name, customer_email, delivered_at) VALUES (9902, 999, "ORD-9902", "delivered", 500, "paid", "CARD", "Test User", "test@user.com", ?)',
    [deliveredRecent.toISOString()]
  );
  await db.run(
    'INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (99021, 9902, 99021, 1, 500, 500, 1)'
  );

  // ----------------------------------------------------
  // TEST 1: State Machine Transition Verifications
  // ----------------------------------------------------
  console.log('\nTest 1: Verifying returnStateMachine transitions...');
  
  expect(isTransitionAllowed('REQUESTED', 'APPROVED', 'return') && isTransitionAllowed('REQUESTED', 'REJECTED', 'return'), 'Allowed transition from REQUESTED to APPROVED / REJECTED validated.');

  expect(isTransitionAllowed('RECEIVED', 'REFUNDED', 'return') && !isTransitionAllowed('RECEIVED', 'REPLACEMENT_SHIPPED', 'return'), 'RECEIVED transitions enforced requestType constraints.');

  // ----------------------------------------------------
  // TEST 2: Controller Submission Checks
  // ----------------------------------------------------
  console.log('\nTest 2: Verifying createReturn controller operation...');
  const retCtrl = createReturnController(db);

  await retCtrl.createReturn(
    {
      params: { id: 9901, variant_id: 99011 },
      body: { request_type: 'return', reason_code: 'DAMAGED_ITEM', reason_description: 'Arrived broken' },
      userId: 999
    },
    mockRes
  );

  expect(mockRes.statusCode === 201 && mockRes.data && mockRes.data.status === 'REQUESTED', 'Return request created successfully via controller.', { statusCode: mockRes.statusCode, data: mockRes.data });

  // Verify transition audit event row was inserted
  const event = await db.get('SELECT * FROM return_events WHERE return_id = ?', [mockRes.data.return_id]);
  expect(event && event.new_status === 'REQUESTED' && event.actor_type === 'customer' && event.notes === 'Arrived broken', 'Exact single return audit event logged in return_events.', event);

  // ----------------------------------------------------
  // TEST 3: Uniqueness & Concurrency Constraint Check
  // ----------------------------------------------------
  let dbFailed = false;
  try {
    await db.run(
      `INSERT INTO returns (order_id, order_item_id, variant_id, user_id, request_type, reason_code, status)
       VALUES (9901, 99011, 99011, 999, 'return', 'CHANGED_MIND', 'REQUESTED')`
    );
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      dbFailed = true;
    }
  }

  expect(dbFailed, 'Database unique index constraint correctly blocked concurrent active duplicate request.');

  // ----------------------------------------------------
  // TEST 4: Admin State Transition Updates
  // ----------------------------------------------------
  console.log('\nTest 4: Verifying admin updates and state machine validation...');
  const activeReturnId = 1;

  // Let's perform an invalid transition (REQUESTED -> RECEIVED directly)
  await retCtrl.updateReturnStatus(
    {
      params: { return_id: activeReturnId },
      body: { status: 'RECEIVED', admin_notes: 'Jump states' },
      userId: 100 // Admin user id
    },
    mockRes
  );

  expect(mockRes.statusCode === 400 && mockRes.data.message.includes('Invalid state transition'), 'Controller correctly blocked illegal transition.', { statusCode: mockRes.statusCode, data: mockRes.data });

  // Now perform a valid transition (REQUESTED -> APPROVED)
  await retCtrl.updateReturnStatus(
    {
      params: { return_id: activeReturnId },
      body: { status: 'APPROVED', admin_notes: 'Approve request' },
      userId: 100
    },
    mockRes
  );

  const updatedReturn = await db.get('SELECT status, approved_at FROM returns WHERE return_id = ?', [activeReturnId]);
  expect(updatedReturn && updatedReturn.status === 'APPROVED' && updatedReturn.approved_at, 'Transition updated return status and stored approved_at timestamp successfully.', updatedReturn);

  // ----------------------------------------------------
  // TEST 5: Option B Rejection Resubmission eligibility
  // ----------------------------------------------------
  console.log('\nTest 5: Verifying Option B rejection closes request and ignores it for eligibility...');

  // Create another request for order 9902
  await retCtrl.createReturn(
    {
      params: { id: 9902, variant_id: 99021 },
      body: { request_type: 'replacement', reason_code: 'QUALITY_ISSUE', reason_description: 'Bad sound quality' },
      userId: 999
    },
    mockRes
  );
  
  const returnId2 = mockRes.data.return_id;

  // Verify eligibility is REQUEST_EXISTS
  let el1 = await getReturnEligibility(db, 9902, 99021);
  expect(el1.status === 'REQUEST_EXISTS', 'Active request identified as REQUEST_EXISTS.', el1);

  // Reject the request
  await retCtrl.updateReturnStatus(
    {
      params: { return_id: returnId2 },
      body: { status: 'REJECTED', admin_notes: 'Denied' },
      userId: 100
    },
    mockRes
  );

  // Now, check eligibility again. It should clear REQUEST_EXISTS and display REPLACEMENT_ELIGIBLE (Option B)
  let el2 = await getReturnEligibility(db, 9902, 99021);
  expect(el2.status === 'REPLACEMENT_ELIGIBLE', 'Option B validated. Rejected requests do not block new eligibility checks.', el2);

  // Clean up database connection
  await db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (failures.length > 0) {
    throw new Error(`Phase 5B verification failed with ${failures.length} issue(s): ${failures.join('; ')}`);
  }
  console.log('\nAll Phase 5B Workflow Engine tests run completed.');
}

runTests().catch(err => {
  console.error('Unhandled test run error:', err);
});
