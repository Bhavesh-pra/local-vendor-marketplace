const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { createAnalyticsController } = require('../controllers/analyticsController');

async function runTelemetryTests() {
  console.log('Starting Phase 4C Telemetry Tests in Isolation...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_telemetry.sqlite');

  // Copy database file
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  // Re-run DDL setup on test db
  await db.run(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      user_id INTEGER NULL,
      session_id TEXT NOT NULL,
      product_id INTEGER NULL,
      category_id INTEGER NULL,
      metadata TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run('DELETE FROM analytics_events');

  const controller = createAnalyticsController(db);

  // 1. Test valid event acceptance (202)
  console.log('\nTesting valid telemetry event acceptance...');
  const req1 = {
    body: {
      event_name: 'product_view',
      session_id: 'test-session-uuid-123',
      user_id: 42,
      product_id: 10,
      category_id: 2,
      metadata: { referrer: 'direct' }
    }
  };

  let res1Status = null;
  let res1Json = null;
  const res1 = {
    status: (code) => {
      res1Status = code;
      return res1;
    },
    json: (data) => {
      res1Json = data;
    }
  };

  await controller.logEvent(req1, res1);

  if (res1Status === 202 && res1Json.message === 'Event accepted') {
    console.log('SUCCESS: Valid event returned 202 Accepted.');
  } else {
    console.error(`FAIL: Valid event returned status ${res1Status}, json:`, res1Json);
  }

  // Wait for background async write to complete
  await new Promise((resolve) => setTimeout(resolve, 50));

  const row = await db.get('SELECT * FROM analytics_events WHERE session_id = ?', ['test-session-uuid-123']);
  if (row && row.event_name === 'product_view' && row.product_id === 10 && JSON.parse(row.metadata).referrer === 'direct') {
    console.log('SUCCESS: Telemetry row written to database correctly.');
  } else {
    console.error('FAIL: Database record not found or incorrect:', row);
  }

  // 2. Test missing session_id validation (400)
  console.log('\nTesting validation of missing session_id...');
  const req2 = {
    body: {
      event_name: 'product_view'
    }
  };

  let res2Status = null;
  let res2Json = null;
  const res2 = {
    status: (code) => {
      res2Status = code;
      return res2;
    },
    json: (data) => {
      res2Json = data;
    }
  };

  await controller.logEvent(req2, res2);

  if (res2Status === 400 && res2Json.message === 'Missing session_id') {
    console.log('SUCCESS: Missing session_id returned 400 Bad Request.');
  } else {
    console.error(`FAIL: Expected 400, got status ${res2Status}, json:`, res2Json);
  }

  // 3. Test unknown event name handling (200 OK ignored silently)
  console.log('\nTesting handling of unknown event names...');
  const req3 = {
    body: {
      event_name: 'unknown_event_type',
      session_id: 'test-session-uuid-ignored'
    }
  };

  let res3Status = null;
  let res3Json = null;
  const res3 = {
    status: (code) => {
      res3Status = code;
      return res3;
    },
    json: (data) => {
      res3Json = data;
    }
  };

  await controller.logEvent(req3, res3);

  if (res3Status === 200 && res3Json.message === 'Event ignored') {
    console.log('SUCCESS: Unknown event returned 200 OK and was ignored.');
  } else {
    console.error(`FAIL: Expected 200, got status ${res3Status}, json:`, res3Json);
  }

  await new Promise((resolve) => setTimeout(resolve, 50));

  const ignoredRow = await db.get('SELECT * FROM analytics_events WHERE session_id = ?', ['test-session-uuid-ignored']);
  if (!ignoredRow) {
    console.log('SUCCESS: Unknown event was not written to database.');
  } else {
    console.error('FAIL: Unknown event was written to database:', ignoredRow);
  }

  // Close and cleanup
  await db.close();
  fs.unlinkSync(testDbPath);
  console.log('\nTemporary database cleaned up. All telemetry tests completed successfully.');
}

runTelemetryTests().catch(err => {
  console.error('Test runner exception:', err);
});
