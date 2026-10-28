const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { createPaymentController } = require('../controllers/paymentController');
const { createPayoutController } = require('../controllers/payoutController');

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
  console.log('Starting Phase 8 Mock Payment Ecosystem Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_payments.sqlite');

  // Copy database file to avoid cluttering main db
  fs.copyFileSync(mainDbPath, testDbPath);

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  try {
    // 1. Setup Test Environment & Backfills
    // Re-verify settings table is seeded
    await db.run(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run("INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('commission_percentage', '10')");
    await db.run("INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('fixed_transaction_fee', '15')");
    await db.run("INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('minimum_commission', '0')");
    await db.run("INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('maximum_commission', '10000')");

    // Create payment-related tables if they do not exist
    await db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(order_id),
        payment_method TEXT NOT NULL CHECK(payment_method IN ('COD', 'UPI', 'CARD', 'WALLET')),
        status TEXT NOT NULL CHECK(status IN ('created', 'initiated', 'processing', 'authorized', 'captured', 'completed', 'failed', 'cancelled', 'expired', 'refunded', 'partially_refunded')),
        amount REAL NOT NULL,
        transaction_reference TEXT UNIQUE,
        idempotency_key TEXT UNIQUE,
        gateway_outcome TEXT CHECK(gateway_outcome IN ('success', 'failure', 'timeout', 'cancelled', 'expired', 'pending')),
        failure_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS payment_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL REFERENCES payments(payment_id),
        previous_state TEXT,
        new_state TEXT NOT NULL,
        actor TEXT NOT NULL CHECK(actor IN ('system', 'customer', 'admin')),
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS refunds (
        refund_id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL REFERENCES payments(payment_id),
        amount REAL NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('requested', 'approved', 'processing', 'completed', 'rejected', 'failed')),
        rejection_reason TEXT,
        idempotency_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(user_id),
        type TEXT NOT NULL CHECK(type IN ('deposit', 'payment', 'refund', 'adjustment_credit', 'adjustment_debit')),
        amount REAL NOT NULL,
        reference_id TEXT,
        idempotency_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS supplier_payouts (
        payout_id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL REFERENCES users(user_id),
        order_id INTEGER NOT NULL REFERENCES orders(order_id),
        amount REAL NOT NULL,
        commission_deducted REAL NOT NULL,
        platform_fee_deducted REAL NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'scheduled', 'processing', 'completed', 'failed')),
        timeline TEXT,
        idempotency_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run('DROP TABLE IF EXISTS financial_events');
    await db.run(`
      CREATE TABLE IF NOT EXISTS financial_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('payment', 'refund', 'refund_disbursement', 'payout', 'wallet_transaction')),
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL CHECK(actor IN ('system', 'customer', 'admin')),
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure orders table supports WALLET payment method and extended payment statuses.
    // Instead of rename-copy-drop (fragile with SQLite), we drop-recreate since test data is disposable.
    await db.run("PRAGMA foreign_keys = OFF");
    // Clean all tables that reference orders first
    await db.run('DELETE FROM payments');
    await db.run('DELETE FROM payment_events');
    await db.run('DELETE FROM refunds');
    await db.run('DELETE FROM wallet_transactions');
    await db.run('DELETE FROM supplier_payouts');
    await db.run('DELETE FROM financial_events');
    await db.run('DELETE FROM order_items');
    // Clean up any leftover orders_old from previous failed migrations
    await db.run('DROP TABLE IF EXISTS orders_old');
    // Recreate orders with extended CHECK constraints
    await db.run('DROP TABLE IF EXISTS order_requests');
    await db.run('DROP TABLE IF EXISTS order_items');
    await db.run('DROP TABLE IF EXISTS order_items_legacy');
    await db.run('DROP TABLE IF EXISTS orders');
    await db.run(`
      CREATE TABLE orders (
        order_id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id             INTEGER NOT NULL,
        order_number        TEXT NOT NULL UNIQUE,
        status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','processing','shipped','delivered','cancelled','returned')),
        payment_method      TEXT NOT NULL
                            CHECK (payment_method IN ('COD','UPI','CARD','WALLET')),
        payment_status      TEXT NOT NULL DEFAULT 'pending'
                            CHECK (payment_status IN ('pending','paid','failed','refunded','partially_refunded')),
        subtotal_amount     NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
        shipping_amount     NUMERIC NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
        tax_amount          NUMERIC NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
        total_amount        NUMERIC NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
        customer_name       TEXT NOT NULL,
        customer_email      TEXT NOT NULL,
        customer_phone      TEXT,
        address_line_1      TEXT,
        address_line_2      TEXT,
        city                TEXT,
        state               TEXT,
        postal_code         TEXT,
        country_code        TEXT NOT NULL DEFAULT 'IN',
        placed_at           TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
        delivered_at        TEXT,
        coupon_id           INTEGER DEFAULT NULL,
        discount_amount     REAL DEFAULT 0,
        coupon_code_snapshot TEXT DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT
      )
    `);
    // Recreate order_items with correct FK pointing to orders (not orders_old)
    await db.run(`
      CREATE TABLE order_items (
        order_item_id        INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id             INTEGER NOT NULL,
        variant_id           INTEGER NOT NULL,
        supplier_id          INTEGER NOT NULL,
        quantity             INTEGER NOT NULL CHECK (quantity > 0),
        unit_price           NUMERIC NOT NULL CHECK (unit_price >= 0),
        line_total           NUMERIC NOT NULL CHECK (line_total >= 0),
        created_at           TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON UPDATE CASCADE ON DELETE RESTRICT
      )
    `);
    // Recreate order_requests with correct FK pointing to orders (not orders_old)
    await db.run(`
      CREATE TABLE order_requests (
        request_id   INTEGER PRIMARY KEY,
        order_id     INTEGER NOT NULL,
        user_id      INTEGER NOT NULL,
        request_type TEXT NOT NULL CHECK (request_type IN ('cancel','return','replacement')),
        reason       TEXT,
        status       TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
        admin_note   TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at  TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (user_id)  REFERENCES users(user_id)  ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);
    // FK checks remain OFF for the test database — legacy tables have broken FK refs to orders_old

    // Create test user and order
    await db.run("INSERT OR IGNORE INTO users (user_id, username, password_hash, email, role) VALUES (999, 'test_buyer', 'pw', 'buyer@test.com', 'customer')");
    await db.run("INSERT OR IGNORE INTO users (user_id, username, password_hash, email, role) VALUES (111, 'test_supplier', 'pw', 'supplier@test.com', 'supplier')");

    await db.run(`
      INSERT INTO orders (order_id, user_id, order_number, status, payment_method, payment_status, total_amount, customer_name, customer_email, placed_at)
      VALUES (801, 999, 'ORD-8001', 'pending', 'CARD', 'pending', 1000, 'Test Buyer', 'buyer@test.com', datetime('now'))
    `);

    await db.run(`
      INSERT INTO order_items (order_id, variant_id, supplier_id, quantity, unit_price, line_total)
      VALUES (801, 5, 111, 2, 500, 1000)
    `);

    const paymentCtrl = createPaymentController(db);
    const payoutCtrl = createPayoutController(db);

    // ─── Test 1: Initiate Payment & Idempotency Key ───
    const req1 = {
      body: { order_id: 801, payment_method: 'CARD', idempotency_key: 'idem-pay-801' },
      headers: { 'x-idempotency-key': 'idem-pay-801' },
      userId: 999,
      role: 'customer'
    };
    const res1 = mockResponse();
    await paymentCtrl.initiatePayment(req1, res1);

    if (res1.statusCode !== 201) {
      throw new Error(`Initiate payment failed: expected 210, got ${res1.statusCode}`);
    }
    const payment = res1.jsonData;
    if (payment.status !== 'created' || payment.amount !== 1000) {
      throw new Error('Incorrect payment amount or initial status.');
    }

    // Double execution with same idempotency key
    const res1Duplicate = mockResponse();
    await paymentCtrl.initiatePayment(req1, res1Duplicate);
    if (res1Duplicate.statusCode !== 200) {
      throw new Error(`Idempotency key did not trigger 200 Cache response: got ${res1Duplicate.statusCode}`);
    }

    console.log('✔ Payment initiation & idempotency check verified.');

    // ─── Test 2: Wallet balance & validation checks ───
    // Check wallet balance
    const reqBal = { userId: 999 };
    const resBal = mockResponse();
    await paymentCtrl.getWalletBalance(reqBal, resBal);
    if (resBal.jsonData.balance !== 0) {
      throw new Error('Initial wallet balance should be 0.');
    }

    // Try wallet payment when balance is 0 (should fail)
    await db.run(`
      INSERT INTO orders (order_id, user_id, order_number, status, payment_method, payment_status, total_amount, customer_name, customer_email, placed_at)
      VALUES (802, 999, 'ORD-8002', 'pending', 'WALLET', 'pending', 500, 'Test Buyer', 'buyer@test.com', datetime('now'))
    `);
    const reqPayW = {
      body: { order_id: 802, payment_method: 'WALLET', idempotency_key: 'idem-pay-802' },
      headers: {},
      userId: 999,
      role: 'customer'
    };
    const resPayW = mockResponse();
    await paymentCtrl.initiatePayment(reqPayW, resPayW);
    if (resPayW.statusCode !== 400 || !resPayW.jsonData.message.includes('Insufficient')) {
      throw new Error('Wallet checkout did not block checkout on insufficient balance.');
    }

    // Deposit wallet funds
    const reqDep = {
      body: { amount: 2000, idempotency_key: 'idem-dep-1' },
      headers: {},
      userId: 999,
      role: 'customer'
    };
    const resDep = mockResponse();
    await paymentCtrl.walletDeposit(reqDep, resDep);
    if (resDep.statusCode !== 201) {
      throw new Error('Wallet deposit failed.');
    }

    const resBal2 = mockResponse();
    await paymentCtrl.getWalletBalance(reqBal, resBal2);
    if (resBal2.jsonData.balance !== 2000) {
      throw new Error('Wallet balance did not increase after deposit.');
    }

    console.log('✔ Wallet deposits, balance summaries, and validation constraints verified.');

    // ─── Test 3: Simulate Success, sync states, create payouts ───
    const reqSim = {
      body: { payment_id: payment.payment_id, outcome: 'success' }
    };
    const resSim = mockResponse();
    await paymentCtrl.simulatePayment(reqSim, resSim);
    if (resSim.statusCode !== 200) {
      throw new Error('Payment simulation success returned non-200.');
    }

    // Verify order synced: paid & processing
    const orderObj = await db.get("SELECT * FROM orders WHERE order_id = 801");
    if (orderObj.payment_status !== 'paid' || orderObj.status !== 'processing') {
      throw new Error(`Order state sync failed: payment_status=${orderObj.payment_status}, status=${orderObj.status}`);
    }

    // Verify payout was created with delivery protection (pending status)
    const payout = await db.get("SELECT * FROM supplier_payouts WHERE order_id = 801 AND supplier_id = 111");
    if (!payout) {
      throw new Error('Supplier payout record was not generated.');
    }
    if (payout.status !== 'pending') {
      throw new Error(`Expected initial payout status to be pending, got: ${payout.status}`);
    }
    // commission: 10% of 1000 = 100, + 15 fee = 115. Payout net: 1000 - 115 = 885.
    if (payout.amount !== 885 || payout.commission_deducted !== 115) {
      throw new Error(`Expected payout net ₹885, got ₹${payout.amount}. Commission got ₹${payout.commission_deducted}`);
    }

    console.log('✔ Payment simulation, order states synchronization, and Payout allocations verified.');

    // ─── Test 4: Payout delivery release rules ───
    // Attempting to complete payout in pending status (must fail)
    const reqPayout = {
      body: { payout_id: payout.payout_id },
      role: 'admin'
    };
    const resPayout = mockResponse();
    await payoutCtrl.triggerSupplierPayout(reqPayout, resPayout);
    if (resPayout.statusCode !== 400) {
      throw new Error(`Delivery protection check failed: completed pending payout with code ${resPayout.statusCode}`);
    }

    // Simulate order delivery updates order status -> delivered, payout status -> scheduled
    const adminCtrl = require('../controllers/adminController').createAdminController(db);
    const reqStatus = {
      params: { id: 801 },
      body: { status: 'delivered' }
    };
    const resStatus = mockResponse();
    await adminCtrl.updateOrderStatus(reqStatus, resStatus);

    const payoutUpdated = await db.get("SELECT * FROM supplier_payouts WHERE payout_id = ?", [payout.payout_id]);
    if (payoutUpdated.status !== 'scheduled') {
      throw new Error(`Expected payout to transition to scheduled on delivery, got: ${payoutUpdated.status}`);
    }

    // Complete payout via admin trigger
    const resPayout2 = mockResponse();
    await payoutCtrl.triggerSupplierPayout(reqPayout, resPayout2);
    if (resPayout2.statusCode !== 200) {
      throw new Error(`Admin payout trigger failed: ${resPayout2.jsonData?.message}`);
    }
    const payoutDone = await db.get("SELECT * FROM supplier_payouts WHERE payout_id = ?", [payout.payout_id]);
    if (payoutDone.status !== 'completed') {
      throw new Error(`Payout status should be completed, got: ${payoutDone.status}`);
    }

    console.log('✔ Payout delivery release sequence verified.');

    // ─── Test 5: Full and Partial Refunds ───
    // Request a partial refund
    const reqRef = {
      body: { payment_id: payment.payment_id, amount: 400, reason: 'damaged item', idempotency_key: 'idem-ref-400' },
      headers: {},
      userId: 999,
      role: 'customer'
    };
    const resRef = mockResponse();
    await paymentCtrl.requestRefund(reqRef, resRef);
    if (resRef.statusCode !== 201) {
      throw new Error('Refund request failed.');
    }
    const refund = resRef.jsonData;

    // Approve the refund
    const reqAppr = {
      body: { refund_id: refund.refund_id, outcome: 'approved' },
      role: 'admin'
    };
    const resAppr = mockResponse();
    await payoutCtrl.approveRefund(reqAppr, resAppr);
    if (resAppr.statusCode !== 200) {
      throw new Error('Refund approval failed.');
    }

    // Verify order payment status is partially_refunded
    const orderRefunded = await db.get("SELECT * FROM orders WHERE order_id = 801");
    if (orderRefunded.payment_status !== 'partially_refunded') {
      throw new Error(`Expected order payment_status to be partially_refunded, got: ${orderRefunded.payment_status}`);
    }

    console.log('✔ Refund approvals & partial refunds verified.');

    console.log('SUCCESS: All Phase 8 Mock Payment Ecosystem unit tests completed successfully!');
  } catch (err) {
    console.error('FAILURE inside mock payments test suite:', err.message);
    process.exit(1);
  } finally {
    await db.close();
    // Delete test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
