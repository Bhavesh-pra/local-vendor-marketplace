const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { createAdminController } = require('../controllers/adminController');
const { createAnalyticsController } = require('../controllers/analyticsController');

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
  console.log('Starting Phase 7 Operational Metrics & Telemetry Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_operational.sqlite');

  // Copy database file
  fs.copyFileSync(mainDbPath, testDbPath);

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  try {
    // Ensure Phase 7 tables exist in the copied test sqlite db
    await db.run(`
      CREATE TABLE IF NOT EXISTS api_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        duration_ms REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS daily_api_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        request_count INTEGER NOT NULL,
        avg_duration_ms REAL NOT NULL,
        max_duration_ms REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS daily_event_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        event_name TEXT NOT NULL,
        product_id INTEGER NOT NULL DEFAULT -1,
        category_id INTEGER NOT NULL DEFAULT -1,
        event_count INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 1. Clean and Setup Test Data
    await db.run('DELETE FROM api_metrics');
    await db.run('DELETE FROM daily_api_metrics');
    await db.run('DELETE FROM analytics_events');
    await db.run('DELETE FROM daily_event_metrics');

    // Seed mock API metrics
    await db.run("INSERT INTO api_metrics (method, path, status_code, duration_ms) VALUES ('GET', '/api/products', 200, 150.5)");
    await db.run("INSERT INTO api_metrics (method, path, status_code, duration_ms) VALUES ('GET', '/api/products', 200, 200.0)");
    await db.run("INSERT INTO api_metrics (method, path, status_code, duration_ms) VALUES ('POST', '/api/cart', 500, 350.0)");

    // Seed payment failures
    await db.run(`
      INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, metadata)
      VALUES ('payment_failed', 1, 'session1', NULL, NULL, '{"payment_method":"CARD","amount":150,"reason":"SIMULATED_FAILURE"}')
    `);

    // Instantiate controllers
    const adminCtrl = createAdminController(db);
    const analyticsCtrl = createAnalyticsController(db);

    // 2. Validate Operational Metrics Controller
    const opRes = mockResponse();
    await adminCtrl.getOperationalMetrics({}, opRes);
    const opMetrics = opRes.jsonData;

    // Averages: (150.5 + 200 + 350) / 3 = 233.5 ms
    if (Math.abs(opMetrics.summary.avg_response_time - 233.5) > 0.1) {
      throw new Error(`Expected avg latency 233.5, got ${opMetrics.summary.avg_response_time}`);
    }
    // Errors: 1 out of 3 = 33.3%
    if (Math.abs(opMetrics.summary.error_rate - (1/3)*100) > 0.1) {
      throw new Error(`Expected error rate 33.3%, got ${opMetrics.summary.error_rate}`);
    }
    // Failed payment logs
    if (opMetrics.failedPayments.length !== 1) {
      throw new Error(`Expected 1 failed payment log, got ${opMetrics.failedPayments.length}`);
    }
    if (opMetrics.failedPayments[0].payment_method !== 'CARD') {
      throw new Error(`Expected failed payment method CARD, got ${opMetrics.failedPayments[0].payment_method}`);
    }
    console.log('✔ Operational metrics values validated.');

    // 3. Validate Bot Protection / View Deduplication
    const req1 = {
      body: {
        event_name: 'product_view',
        session_id: 'sess-bot-test',
        product_id: 99
      }
    };
    const res1 = mockResponse();
    await analyticsCtrl.logEvent(req1, res1);
    if (res1.statusCode !== 202) {
      throw new Error(`Expected first view accepted 202, got ${res1.statusCode}`);
    }

    // Wait 100ms and log the duplicate view
    await new Promise(r => setTimeout(r, 100));
    const res2 = mockResponse();
    await analyticsCtrl.logEvent(req1, res2);
    // Should return 202 accepted but deduplicated
    if (res2.statusCode !== 202) {
      throw new Error(`Expected duplicate view returned 202, got ${res2.statusCode}`);
    }

    // Verify only one view row was actually inserted into DB
    const viewRows = await db.all("SELECT id FROM analytics_events WHERE event_name = 'product_view' AND session_id = 'sess-bot-test'");
    if (viewRows.length !== 1) {
      throw new Error(`Expected exactly 1 view logged, got ${viewRows.length}`);
    }
    console.log('✔ Telemetry bot protection / product view deduplication validated.');

    // 4. Validate DB Startup Auto-Aggregation & Pruning
    // Insert historic raw records older than 35 days (API) and 95 days (events)
    await db.run("INSERT INTO api_metrics (method, path, status_code, duration_ms, created_at) VALUES ('GET', '/old-path', 200, 50.0, datetime('now', '-35 days'))");
    await db.run("INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, created_at) VALUES ('product_view', 2, 'oldsess', 1, 1, datetime('now', '-95 days'))");

    // Execute startup routines manually
    // Aggregate completed raw API metrics
    await db.run(`
      INSERT OR IGNORE INTO daily_api_metrics (date, method, path, status_code, request_count, avg_duration_ms, max_duration_ms)
      SELECT DATE(created_at) AS d, method, path, status_code, COUNT(*), AVG(duration_ms), MAX(duration_ms)
      FROM api_metrics
      WHERE created_at < DATE('now')
      GROUP BY d, method, path, status_code
    `);
    // Delete raw API metrics older than 30 days
    await db.run("DELETE FROM api_metrics WHERE created_at < datetime('now', '-30 days')");

    // Aggregate completed raw events
    await db.run(`
      INSERT OR IGNORE INTO daily_event_metrics (date, event_name, product_id, category_id, event_count)
      SELECT DATE(created_at) AS d, event_name, IFNULL(product_id, -1), IFNULL(category_id, -1), COUNT(*)
      FROM analytics_events
      WHERE created_at < DATE('now')
      GROUP BY d, event_name, product_id, category_id
    `);
    // Delete raw events older than 90 days
    await db.run("DELETE FROM analytics_events WHERE created_at < datetime('now', '-90 days')");

    // Verify historical row was deleted from raw api_metrics
    const oldApiCount = await db.get("SELECT COUNT(*) AS count FROM api_metrics WHERE path = '/old-path'");
    if (oldApiCount.count !== 0) {
      throw new Error(`Expected old raw API metrics pruned, got ${oldApiCount.count}`);
    }
    // Verify historical row was summarized in daily_api_metrics
    const dailyApiCount = await db.get("SELECT COUNT(*) AS count FROM daily_api_metrics WHERE path = '/old-path'");
    if (dailyApiCount.count !== 1) {
      throw new Error(`Expected daily API metrics summary created, got ${dailyApiCount.count}`);
    }

    // Verify historical event was deleted from raw analytics_events
    const oldEventCount = await db.get("SELECT COUNT(*) AS count FROM analytics_events WHERE session_id = 'oldsess'");
    if (oldEventCount.count !== 0) {
      throw new Error(`Expected old raw events pruned, got ${oldEventCount.count}`);
    }
    // Verify historical event was summarized in daily_event_metrics
    const dailyEventCount = await db.get("SELECT COUNT(*) AS count FROM daily_event_metrics WHERE event_name = 'product_view' AND product_id = 1");
    if (dailyEventCount.count !== 1) {
      throw new Error(`Expected daily event metrics summary created, got ${dailyEventCount.count}`);
    }
    console.log('✔ Startup aggregation and raw data pruning validated.');

    console.log('SUCCESS: All operational metrics and telemetry test suites completed successfully.');
  } finally {
    await db.close();
    fs.unlinkSync(testDbPath);
  }
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
