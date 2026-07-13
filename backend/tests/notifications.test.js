/**
 * Phase 5E — Notification Engine Verification Tests
 */
const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { createNotification } = require('../services/notificationService');
const { createOrderController } = require('../controllers/orderController');
const { createAdminController } = require('../controllers/adminController');
const { createReturnController } = require('../controllers/returnController');
const { createNotificationController } = require('../controllers/notificationController');

async function runTests() {
  console.log('Starting Phase 5E Notification Engine Verification Tests...');
  const failures = [];
  const expect = (condition, message, details) => {
    if (condition) {
      return;
    }
    failures.push(message);
    console.error(`Assertion failed: ${message}`, details ?? '');
  };

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_notifications.sqlite');

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  // Ensure notifications table and indexes are set up in test db
  await db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      type            TEXT NOT NULL,
      title           TEXT NOT NULL,
      message         TEXT NOT NULL,
      metadata        TEXT,
      event_key       TEXT UNIQUE NOT NULL,
      is_read         INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      read_at         TEXT DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE
    )
  `);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read)`);

  // Clear previous test notifications
  await db.run('DELETE FROM notifications');

  // Set up mock test user, category, product, variant, cart, and coupon
  const TEST_USER_ID = 999;
  const OTHER_USER_ID = 888;
  const SUPPLIER_ID = 1;
  const VARIANT_ID = 99011;
  const PRODUCT_ID = 9901;

  await db.run('INSERT OR IGNORE INTO users (user_id, username, email, password_hash, role) VALUES (?, "testuser", "test@user.com", "pass", "customer")', [TEST_USER_ID]);
  await db.run('INSERT OR IGNORE INTO users (user_id, username, email, password_hash, role) VALUES (?, "otheruser", "other@user.com", "pass", "customer")', [OTHER_USER_ID]);
  await db.run('INSERT OR IGNORE INTO suppliers (supplier_id, supplier_name) VALUES (?, "Supplier1")', [SUPPLIER_ID]);
  await db.run('INSERT OR IGNORE INTO categories (category_id, category_name, category_slug) VALUES (999, "Electronics", "electronics")');
  await db.run('DELETE FROM products WHERE product_id = ?', [PRODUCT_ID]);
  await db.run(`
    INSERT INTO products (product_id, supplier_id, category_id, product_name, brand, selling_price, cost_price, mrp, product_status, slug, description) VALUES
      (?, ?, 999, 'Test Product', 'BrandX', 1000, 800, 1200, 'active', 'test-prod', 'Test description')
  `, [PRODUCT_ID, SUPPLIER_ID]);

  await db.run('DELETE FROM product_variants WHERE variant_id = ?', [VARIANT_ID]);
  await db.run(`
    INSERT INTO product_variants (variant_id, product_id, sku, size, color, price_override, cost_override, mrp_override, status) VALUES
      (?, ?, 'SKU-99011', '16GB', 'Silver', 1000, 800, 1200, 'active')
  `, [VARIANT_ID, PRODUCT_ID]);

  await db.run('DELETE FROM inventory WHERE variant_id = ?', [VARIANT_ID]);
  await db.run('INSERT INTO inventory (variant_id, available_stock, purchase_price, supplier_id) VALUES (?, 100, 800, ?)', [VARIANT_ID, SUPPLIER_ID]);

  // Insert mock coupon
  const COUPON_ID = 77;
  await db.run('DELETE FROM coupons WHERE coupon_id = ?', [COUPON_ID]);
  await db.run(`
    INSERT INTO coupons (coupon_id, coupon_code, coupon_type, discount_value, expiration_date, status)
    VALUES (?, 'TEST50', 'fixed', 50, '2030-12-31', 'active')
  `, [COUPON_ID]);

  // Insert active cart for placement test
  const CART_ID = 88;
  await db.run('DELETE FROM cart WHERE cart_id = ?', [CART_ID]);
  await db.run('INSERT INTO cart (cart_id, user_id, status) VALUES (?, ?, "active")', [CART_ID, TEST_USER_ID]);
  await db.run('DELETE FROM cart_items WHERE cart_id = ?', [CART_ID]);
  await db.run('INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price) VALUES (?, ?, 1, 1000)', [CART_ID, VARIANT_ID]);

  // ---------------------------------------------------------------------------
  // TEST 1: Order Placement & Coupon Application Notification Generation
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Order Placement & Coupon Application ---');
  const mockSendEmail = async () => {};
  const orderController = createOrderController(db, mockSendEmail);

  const reqPlace = {
    userId: TEST_USER_ID,
    body: {
      cart_id: CART_ID,
      paymentMethod: 'COD',
      name: 'Test Customer',
      email: 'test@user.com',
      address: '123 Main St',
      phone: '1234567890',
      coupon_code: 'TEST50'
    }
  };
  let resData = null;
  const resPlace = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { resData = data; return this; }
  };

  await orderController.placeOrder(reqPlace, resPlace);
  expect(resPlace.statusCode === 201, 'Order placement succeeded', resData);

  const orderId = resData.order_id;

  // Verify notifications created
  const notifs = await db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY notification_id ASC', [TEST_USER_ID]);
  expect(notifs.length === 2, 'Exactly two notifications were created for order placement', notifs);

  const orderPlacedNotif = notifs.find(n => n.type === 'ORDER_PLACED');
  expect(orderPlacedNotif !== undefined, 'ORDER_PLACED notification exists');
  expect(orderPlacedNotif?.event_key === `ORDER_PLACED:${orderId}`, 'ORDER_PLACED event_key is correct', orderPlacedNotif);
  expect(JSON.parse(orderPlacedNotif?.metadata || '{}').order_id === orderId, 'ORDER_PLACED metadata contains order_id', orderPlacedNotif);

  const couponAppliedNotif = notifs.find(n => n.type === 'COUPON_APPLIED');
  expect(couponAppliedNotif !== undefined, 'COUPON_APPLIED notification exists');
  expect(couponAppliedNotif?.event_key === `COUPON_APPLIED:${orderId}`, 'COUPON_APPLIED event_key is correct', couponAppliedNotif);

  // ---------------------------------------------------------------------------
  // TEST 2: Order Status Transitions Notification Generation
  // ---------------------------------------------------------------------------
  console.log('--- TEST 2: Order Status Transitions ---');
  const adminController = createAdminController(db);

  const transitionStatuses = [
    { status: 'processing', type: 'ORDER_CONFIRMED' },
    { status: 'shipped', type: 'ORDER_SHIPPED' },
    { status: 'delivered', type: 'ORDER_DELIVERED' }
  ];

  for (const { status, type } of transitionStatuses) {
    const reqStatus = {
      params: { id: orderId },
      body: { status }
    };
    const resStatus = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { return this; }
    };
    await adminController.updateOrderStatus(reqStatus, resStatus);
    expect(resStatus.statusCode === 200, `Order status updated to ${status}`);

    const notif = await db.get('SELECT * FROM notifications WHERE type = ? AND event_key = ?', [type, `${type}:${orderId}`]);
    expect(notif !== undefined, `Notification exists for status transition ${status}`);
    expect(notif?.user_id === TEST_USER_ID, `Notification for ${status} targets the order owner`, notif);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Return Notifications Generation
  // ---------------------------------------------------------------------------
  console.log('--- TEST 3: Return Notifications ---');
  const returnController = createReturnController(db);

  // Setup mock return policy
  await db.run('INSERT OR IGNORE INTO return_policies (policy_id, name, type, days) VALUES (1, "7 Days Return", "returnable", 7)');
  await db.run('UPDATE products SET return_policy_id = 1 WHERE product_id = ?', [PRODUCT_ID]);

  // Insert mock return request
  const reqCreateReturn = {
    userId: TEST_USER_ID,
    params: { id: orderId, variant_id: VARIANT_ID },
    body: {
      request_type: 'return',
      reason_code: 'DAMAGED_ITEM',
      reason_description: 'Arrived broken'
    }
  };
  let createdReturnData = null;
  const resCreateReturn = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { createdReturnData = data; return this; }
  };

  await returnController.createReturn(reqCreateReturn, resCreateReturn);
  expect(resCreateReturn.statusCode === 201, 'Return request creation succeeded', createdReturnData);

  const returnId = createdReturnData.return_id;

  // Verify RETURN_REQUESTED notification
  let returnNotif = await db.get('SELECT * FROM notifications WHERE type = "RETURN_REQUESTED" AND event_key = ?', [`RETURN_REQUESTED:${returnId}`]);
  expect(returnNotif !== undefined, 'RETURN_REQUESTED notification exists');

  // Verify transition status notifications
  const returnTransitions = [
    { status: 'APPROVED', type: 'RETURN_APPROVED' },
    { status: 'PICKUP_SCHEDULED', type: 'PICKUP_SCHEDULED' },
    { status: 'PICKED_UP', type: 'RETURN_PICKED_UP' },
    { status: 'RECEIVED', type: 'RETURN_RECEIVED' },
    { status: 'REFUNDED', type: null }, // no notification for intermediate REFUNDED status
    { status: 'REFUND_COMPLETED', type: 'REFUND_COMPLETED' }
  ];

  for (const { status, type } of returnTransitions) {
    const reqUpdate = {
      userId: TEST_USER_ID,
      params: { return_id: returnId },
      body: { status }
    };
    const resUpdate = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { return this; }
    };
    await returnController.updateReturnStatus(reqUpdate, resUpdate);
    expect(resUpdate.statusCode === 200, `Return status transition to ${status} succeeded`);

    if (type) {
      const notif = await db.get('SELECT * FROM notifications WHERE type = ? AND event_key = ?', [type, `${type}:${returnId}`]);
      expect(notif !== undefined, `Return notification exists for status transition ${status}`);
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Review Moderation Notifications Generation
  // ---------------------------------------------------------------------------
  console.log('--- TEST 4: Review Moderation ---');
  const REVIEW_ID = 55;
  await db.run('DELETE FROM reviews WHERE review_id = ?', [REVIEW_ID]);
  await db.run('INSERT INTO reviews (review_id, product_id, user_id, rating, title, comment, status) VALUES (?, ?, ?, 5, "Good", "Excellent", "approved")', [REVIEW_ID, PRODUCT_ID, TEST_USER_ID]);

  // Hide review
  const reqHide = {
    userId: 1, // Admin ID
    params: { id: REVIEW_ID },
    body: { status: 'hidden', notes: 'Inappropriate content' }
  };
  const resHide = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { return this; }
  };
  await adminController.updateReviewStatus(reqHide, resHide);
  expect(resHide.statusCode === 200, 'Review hide action succeeded');

  let reviewNotif = await db.get('SELECT * FROM notifications WHERE type = "REVIEW_HIDDEN" AND event_key = ?', [`REVIEW_HIDDEN:${REVIEW_ID}`]);
  expect(reviewNotif !== undefined, 'REVIEW_HIDDEN notification exists');

  // Restore review
  const reqRestore = {
    userId: 1, // Admin ID
    params: { id: REVIEW_ID },
    body: { status: 'approved', notes: 'Content looks ok' }
  };
  const resRestore = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { return this; }
  };
  await adminController.updateReviewStatus(reqRestore, resRestore);
  expect(resRestore.statusCode === 200, 'Review restore action succeeded');

  reviewNotif = await db.get('SELECT * FROM notifications WHERE type = "REVIEW_RESTORED" AND event_key = ?', [`REVIEW_RESTORED:${REVIEW_ID}`]);
  expect(reviewNotif !== undefined, 'REVIEW_RESTORED notification exists');

  // ---------------------------------------------------------------------------
  // TEST 5: Duplicate Prevention (Idempotency)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 5: Duplicate Prevention (Idempotency) ---');
  const countBefore = (await db.get('SELECT COUNT(*) as count FROM notifications')).count;

  // Insert notification with an existing event_key (silently ignored)
  await createNotification(db, {
    user_id: TEST_USER_ID,
    type: 'ORDER_PLACED',
    title: 'Duplicate Title',
    message: 'Duplicate Message',
    metadata: { order_id: orderId },
    event_key: `ORDER_PLACED:${orderId}`
  });

  const countAfter = (await db.get('SELECT COUNT(*) as count FROM notifications')).count;
  expect(countBefore === countAfter, 'Duplicate event_key insert does not create a second notification', { countBefore, countAfter });

  // ---------------------------------------------------------------------------
  // TEST 6: Read State Transitions & Ownership Validation
  // ---------------------------------------------------------------------------
  console.log('--- TEST 6: Read State Transitions & Ownership ---');
  const notifController = createNotificationController(db);

  const testNotif = await db.get('SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 LIMIT 1', [TEST_USER_ID]);
  expect(testNotif !== undefined, 'Unread test notification exists');

  // 1. Mark as read ownership mismatch
  const reqReadInvalid = {
    userId: OTHER_USER_ID, // Mismatched user
    params: { id: testNotif.notification_id }
  };
  const resReadInvalid = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { return this; }
  };
  await notifController.markAsRead(reqReadInvalid, resReadInvalid);
  expect(resReadInvalid.statusCode === 403, 'markAsRead rejects cross-user ownership access', resReadInvalid.statusCode);

  // 2. Mark as read valid
  const reqReadValid = {
    userId: TEST_USER_ID,
    params: { id: testNotif.notification_id }
  };
  const resReadValid = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { return this; }
  };
  await notifController.markAsRead(reqReadValid, resReadValid);
  expect(resReadValid.statusCode === 200, 'markAsRead succeeds for the owner');

  const updatedNotif = await db.get('SELECT * FROM notifications WHERE notification_id = ?', [testNotif.notification_id]);
  expect(updatedNotif.is_read === 1, 'is_read column updated to 1', updatedNotif);
  expect(updatedNotif.read_at !== null, 'read_at timestamp was set', updatedNotif);

  // 3. Mark all as read
  const reqReadAll = {
    userId: TEST_USER_ID
  };
  const resReadAll = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { return this; }
  };
  await notifController.markAllAsRead(reqReadAll, resReadAll);
  expect(resReadAll.statusCode === 200, 'markAllAsRead succeeds');

  const remainingUnread = (await db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [TEST_USER_ID])).count;
  expect(remainingUnread === 0, 'All notifications were marked as read', remainingUnread);

  console.log('All tests passed successfully!');

  // Cleanup test database
  db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (failures.length > 0) {
    throw new Error(`Phase 5E verification failed with ${failures.length} issue(s): ${failures.join('; ')}`);
  }
  console.log('Cleanup complete.');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
