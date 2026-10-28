const { createSessionService } = require('../services/sessionService');
const { validateSchema } = require('../middleware/validate');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('Starting Hardening, Sessions, and Validation Tests...');
  const failures = [];
  const expect = (condition, message) => {
    if (condition) {
      console.log(`SUCCESS: ${message}`);
    } else {
      failures.push(message);
      console.error(`FAIL: ${message}`);
    }
  };

  const testDbPath = path.join(__dirname, 'test_hardening.sqlite');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  try {
    // 1. Setup minimal tables
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        ip_address TEXT,
        user_agent TEXT,
        expires_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        revoked_at TEXT
      )
    `);

    // Insert active test user
    await db.run(`
      INSERT INTO users (user_id, username, email, password_hash, role, status)
      VALUES (1, 'UserA', 'usera@test.com', 'hash', 'customer', 'active')
    `);

    process.env.JWT_SECRET = 'TEST_JWT_SECRET_STRING';

    const sessionService = createSessionService(db);

    // Test 1: Refresh Token Generation
    const rawToken = await sessionService.generateRefreshToken(1, '127.0.0.1', 'Mozilla');
    expect(rawToken.length === 80, 'Should generate an 80-char hex refresh token');

    const dbRecord = await db.get('SELECT * FROM refresh_tokens WHERE user_id = 1');
    expect(dbRecord !== undefined, 'Refresh token should be written to database');
    expect(dbRecord.token_hash !== rawToken, 'Token should be hashed before saving (token_hash !== rawToken)');
    expect(dbRecord.ip_address === '127.0.0.1', 'Token should store IP address');
    expect(dbRecord.user_agent === 'Mozilla', 'Token should store user agent');

    // Test 2: Token rotation
    const rotated = await sessionService.verifyAndRotateSession(rawToken, '127.0.0.2', 'Chrome');
    expect(rotated.accessToken !== undefined, 'Rotation should return a new access token');
    expect(rotated.refreshToken !== undefined, 'Rotation should return a new rotated refresh token');
    expect(rotated.refreshToken !== rawToken, 'Rotated refresh token must be a new token');

    const rotatedDbRecord = await db.get('SELECT * FROM refresh_tokens WHERE token_hash = ?', [dbRecord.token_hash]);
    expect(rotatedDbRecord.revoked_at !== null, 'Old refresh token should be marked as revoked');

    // Test 3: Token Reuse Detection (Replay Attacks Protection)
    try {
      await sessionService.verifyAndRotateSession(rawToken, '127.0.0.3', 'Safari');
      expect(false, 'Reusing a revoked refresh token should throw an error');
    } catch (err) {
      expect(err.message.includes('Token reuse detected'), 'Should detect token reuse and raise alarm');
    }

    // Verify all sessions revoked for user 1 after reuse attempt
    const activeSessionsCount = await db.get('SELECT COUNT(*) as active FROM refresh_tokens WHERE user_id = 1 AND revoked_at IS NULL');
    expect(activeSessionsCount.active === 0, 'All sessions for the user should be revoked upon reuse detection');

    // Test 4: Validation Middleware
    const schema = {
      body: {
        email: { type: 'email', required: true },
        age: { type: 'number', min: 18, required: false }
      }
    };
    const validator = validateSchema(schema);

    let nextCalled = false;
    let responseStatus = null;
    let responseJson = null;

    const mockRes = {
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => { responseJson = data; }
        };
      }
    };

    // Valid inputs
    const mockReqValid = {
      body: { email: 'test@domain.com', age: 25 },
      params: {},
      query: {}
    };
    validator(mockReqValid, mockRes, () => { nextCalled = true; });
    expect(nextCalled, 'Validation should call next() for valid inputs');

    // Invalid inputs
    nextCalled = false;
    const mockReqInvalid = {
      body: { email: 'bademail', age: 15 },
      params: {},
      query: {}
    };
    validator(mockReqInvalid, mockRes, () => { nextCalled = true; });
    expect(!nextCalled, 'Validation should block execution for invalid inputs');
    expect(responseStatus === 400, 'Invalid validation should return 400 Bad Request');
    expect(responseJson.success === false, 'Validation failure should report success = false');
    expect(responseJson.errors.email !== undefined, 'Should flag invalid email');
    expect(responseJson.errors.age !== undefined, 'Should flag age range violation');

    await db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    if (failures.length > 0) {
      console.error(`\n❌ Hardening tests failed with ${failures.length} issues.`);
      process.exit(1);
    } else {
      console.log('\n🎉 ALL HARDENING, SESSIONS, AND VALIDATION TESTS PASSED!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Hardening tests crashed:', err.message);
    if (db) await db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    process.exit(1);
  }
}

runTests();
