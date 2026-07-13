const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { checkReviewEligibility } = require('../services/reviewEligibility');
const { createReviewController } = require('../controllers/reviewController');
const { createAdminController } = require('../controllers/adminController');

async function runTests() {
  console.log('Starting Phase 5C Verified Buyer & Review Trust Engine Verification Tests...');
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
  const testDbPath = path.join(__dirname, 'test_review_trust.sqlite');

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  // Ensure fresh schema exists for tests
  await db.run(`DROP TABLE IF EXISTS review_images`);
  await db.run(`DROP TABLE IF EXISTS review_helpful_votes`);
  await db.run(`DROP TABLE IF EXISTS review_moderation_logs`);
  await db.run(`DROP TABLE IF EXISTS reviews`);

  await db.run(`
    CREATE TABLE reviews (
      review_id            INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id           INTEGER NOT NULL,
      user_id              INTEGER NOT NULL,
      order_item_id        INTEGER,
      rating               INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      title                TEXT,
      comment              TEXT,
      is_verified_purchase INTEGER NOT NULL DEFAULT 1 CHECK (is_verified_purchase IN (0, 1)),
      helpful_count        INTEGER NOT NULL DEFAULT 0,
      status               TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'hidden')),
      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.run(`
    CREATE TABLE review_images (
      image_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id   INTEGER NOT NULL,
      image_url   TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.run(`
    CREATE TABLE review_helpful_votes (
      vote_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id   INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (review_id, user_id)
    )
  `);

  await db.run(`
    CREATE TABLE review_moderation_logs (
      log_id           INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id        INTEGER NOT NULL,
      previous_status  TEXT,
      new_status       TEXT NOT NULL,
      actor_user_id    INTEGER NOT NULL,
      notes            TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create unique index constraints
  await db.run(`
    CREATE UNIQUE INDEX idx_reviews_order_item_user
    ON reviews(order_item_id, user_id)
    WHERE order_item_id IS NOT NULL
  `);

  // Seed mock customer user, categories, suppliers, products, product_variants, and orders
  await db.run('INSERT OR IGNORE INTO categories (category_id, category_name, category_slug) VALUES (999, "Electronics", "electronics")');
  await db.run('INSERT OR IGNORE INTO suppliers (supplier_id, supplier_name) VALUES (1, "Supplier1")');
  
  await db.run(`
    INSERT OR REPLACE INTO products (product_id, supplier_id, category_id, product_name, brand, selling_price, cost_price, mrp, product_status, slug, description) VALUES
      (9901, 1, 999, 'Test Laptop', 'BrandX', 1000, 800, 1200, 'active', 'test-lap', 'laptop desc')
  `);

  await db.run(`
    INSERT OR REPLACE INTO product_variants (variant_id, product_id, sku, size, color, price_override, cost_override, mrp_override, status) VALUES
      (99011, 9901, 'SKU-99011', '16GB', 'Silver', 1000, 800, 1200, 'active')
  `);

  // Clear orders
  await db.run('DELETE FROM orders WHERE order_id >= 9900');
  await db.run('DELETE FROM order_items WHERE order_id >= 9900');

  // Insert Mock delivered order (eligible buyer)
  const deliveredAt = new Date();
  deliveredAt.setDate(deliveredAt.getDate() - 10);
  await db.run(
    'INSERT INTO orders (order_id, user_id, order_number, status, total_amount, payment_status, payment_method, customer_name, customer_email, delivered_at) VALUES (9901, 999, "ORD-9901", "delivered", 1000, "paid", "CARD", "Test User", "test@user.com", ?)',
    [deliveredAt.toISOString()]
  );
  await db.run(
    'INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (99011, 9901, 99011, 1, 1000, 1000, 1)'
  );

  // Insert Mock non-delivered order (ineligible buyer)
  await db.run(
    'INSERT INTO orders (order_id, user_id, order_number, status, total_amount, payment_status, payment_method, customer_name, customer_email) VALUES (9902, 999, "ORD-9902", "shipped", 1000, "paid", "CARD", "Test User", "test@user.com")'
  );
  await db.run(
    'INSERT INTO order_items (order_item_id, order_id, variant_id, quantity, unit_price, line_total, supplier_id) VALUES (99021, 9902, 99011, 1, 1000, 1000, 1)'
  );

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

  // ----------------------------------------------------
  // TEST 1: Review Eligibility Checks
  // ----------------------------------------------------
  console.log('\nTest 1: Verifying checkReviewEligibility...');
  
  // Non-buyer eligibility
  const res1 = await checkReviewEligibility(db, 888, 9901); // user 888 did not purchase anything
  expect(!res1.eligible && res1.message.includes('purchase'), 'Ineligible non-buyer correctly rejected.', res1);

  // Delivered order item buyer eligibility
  const res2 = await checkReviewEligibility(db, 999, 9901);
  expect(res2.eligible && res2.orderItems.length === 1 && res2.orderItems[0].order_item_id === 99011, 'Delivered order item buyer identified as eligible.', res2);

  // ----------------------------------------------------
  // TEST 2: Submission and verified badge generation
  // ----------------------------------------------------
  console.log('\nTest 2: Verifying review submission & verified badge tagging...');
  const revCtrl = createReviewController(db);

  await revCtrl.addReview(
    {
      body: {
        product_id: 9901,
        order_item_id: 99011,
        rating: 5,
        title: 'Awesome!',
        comment: 'Best laptop ever.',
        media_urls: ['/uploads/reviews/image1.jpg']
      },
      userId: 999
    },
    mockRes
  );

  expect(mockRes.statusCode === 201, 'Eligible review created successfully.', { statusCode: mockRes.statusCode, data: mockRes.data });

  const review = await db.get('SELECT * FROM reviews WHERE review_id = 1');
  expect(review && review.is_verified_purchase === 1 && review.title === 'Awesome!', 'Backend-derived Verified Purchase indicator and Title correctly recorded.', review);

  // Confirm image was logged
  const imgRecord = await db.get('SELECT * FROM review_images WHERE review_id = 1');
  expect(imgRecord && imgRecord.image_url === '/uploads/reviews/image1.jpg', 'Attached review images recorded in review_images.', imgRecord);

  // ----------------------------------------------------
  // TEST 3: Duplicate Reviews Prevention
  // ----------------------------------------------------
  console.log('\nTest 3: Verifying one review per order item constraint...');
  
  // Eligibility check should now reject duplicate submissions
  const res3 = await checkReviewEligibility(db, 999, 9901);
  expect(!res3.eligible && res3.message.includes('reviewed all'), 'Eligibility engine rejected duplicate submission.', res3);

  // Try direct database insertion for the same order_item_id (concurrency unique constraint test)
  let dbFailed = false;
  try {
    await db.run(
      `INSERT INTO reviews (product_id, user_id, order_item_id, rating, comment)
       VALUES (9901, 999, 99011, 4, 'Attempting duplicate review')`
    );
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      dbFailed = true;
    }
  }

  expect(dbFailed, 'SQLite unique index successfully blocked concurrent duplicate order item reviews.');

  // ----------------------------------------------------
  // TEST 4: Edit Window Constraint Check
  // ----------------------------------------------------
  console.log('\nTest 4: Verifying 7-day edit window expiration...');
  
  // Set review creation date to 10 days ago
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 10);
  await db.run('UPDATE reviews SET created_at = ? WHERE review_id = 1', [oldDate.toISOString()]);

  // Attempt edit review
  await revCtrl.updateReview(
    {
      params: { review_id: 1 },
      body: { rating: 4, title: 'Updated Title', comment: 'Edited body' },
      userId: 999
    },
    mockRes
  );

  expect(mockRes.statusCode === 400 && mockRes.data.message.includes('7 days'), '7-day edit window expiration blocked modification correctly.', { statusCode: mockRes.statusCode, data: mockRes.data });

  // Restore date to make it within 7 days
  await db.run('UPDATE reviews SET created_at = datetime("now") WHERE review_id = 1');

  // Attempt edit review again
  await revCtrl.updateReview(
    {
      params: { review_id: 1 },
      body: { rating: 4, title: 'Valid Edit', comment: 'Successfully updated comments.' },
      userId: 999
    },
    mockRes
  );

  const edited = await db.get('SELECT title, comment, rating FROM reviews WHERE review_id = 1');
  expect(edited && edited.title === 'Valid Edit' && edited.rating === 4, 'Review successfully modified inside the valid 7-day window.', edited);

  // ----------------------------------------------------
  // TEST 5: Helpful Votes Uniqueness
  // ----------------------------------------------------
  console.log('\nTest 5: Verifying unique helpful voting toggle...');
  
  // First helpful vote
  await revCtrl.voteHelpful({ params: { review_id: 1 }, userId: 999 }, mockRes);
  let revVote = await db.get('SELECT helpful_count FROM reviews WHERE review_id = 1');
  let voteCount = await db.get('SELECT COUNT(*) as count FROM review_helpful_votes WHERE review_id = 1');

  expect(revVote.helpful_count === 1 && voteCount.count === 1, 'First helpful vote registered and count incremented.', { revVote, voteCount });

  // Second helpful vote by same user (should toggle vote OFF)
  await revCtrl.voteHelpful({ params: { review_id: 1 }, userId: 999 }, mockRes);
  revVote = await db.get('SELECT helpful_count FROM reviews WHERE review_id = 1');
  voteCount = await db.get('SELECT COUNT(*) as count FROM review_helpful_votes WHERE review_id = 1');

  expect(revVote.helpful_count === 0 && voteCount.count === 0, 'Second vote by same user toggled vote off and decremented count.', { revVote, voteCount });

  // ----------------------------------------------------
  // TEST 6: Reversible Admin Moderation
  // ----------------------------------------------------
  console.log('\nTest 6: Verifying reversible admin moderation (Approved/Hidden)...');
  const adminCtrl = createAdminController(db);

  // Moderate to 'hidden'
  await adminCtrl.updateReviewStatus(
    {
      params: { id: 1 },
      body: { status: 'hidden', notes: 'Inappropriate language' },
      userId: 100 // Admin actor user id
    },
    mockRes
  );

  let moderatedReview = await db.get('SELECT status FROM reviews WHERE review_id = 1');
  let modLog = await db.get('SELECT * FROM review_moderation_logs WHERE review_id = 1');

  expect(moderatedReview.status === 'hidden' && modLog && modLog.new_status === 'hidden' && modLog.notes === 'Inappropriate language', 'Admin successfully hid the review and logged moderation remarks.', { moderatedReview, modLog });

  // Fetch reviews as customer. Hidden review should NOT appear.
  await revCtrl.getReviews({ params: { product_id: 9901 }, query: {} }, mockRes);
  expect(mockRes.data && mockRes.data.reviews.length === 0, 'Hidden reviews are excluded from customer listing.', mockRes.data);

  // Re-approve / Restore review
  await adminCtrl.updateReviewStatus(
    {
      params: { id: 1 },
      body: { status: 'approved', notes: 'Approved after review' },
      userId: 100
    },
    mockRes
  );

  moderatedReview = await db.get('SELECT status FROM reviews WHERE review_id = 1');
  expect(moderatedReview.status === 'approved', 'Reversible moderation verified: review successfully restored to approved status.', moderatedReview);

  // Admin delete attempt block
  await adminCtrl.deleteReview({ params: { id: 1 } }, mockRes);
  expect(mockRes.statusCode === 403 && mockRes.data.message.includes('forbidden'), 'Admin review deletion is blocked with 403 Forbidden.', { statusCode: mockRes.statusCode, data: mockRes.data });

  // Clean up database connection
  await db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (failures.length > 0) {
    throw new Error(`Phase 5C verification failed with ${failures.length} issue(s): ${failures.join('; ')}`);
  }
  console.log('\nAll Phase 5C Review Trust tests run completed.');
}

runTests().catch(err => {
  console.error('Unhandled test run error:', err);
});
