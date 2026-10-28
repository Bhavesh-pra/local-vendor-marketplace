const http = require('http');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('Starting Security Headers & CORS Tests...');
  
  // Set test environment variables
  process.env.PORT = '3999';
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'TEST_SECRET_KEY';
  process.env.FRONTEND_URL = 'http://allowed-frontend.com';
  process.env.DATABASE_PATH = 'ecommerce.sqlite';
  
  // Start server
  require('../index');

  // Give the server 1 second to bind and initialize DB
  await new Promise(resolve => setTimeout(resolve, 1500));

  const failures = [];
  const expect = (condition, message) => {
    if (condition) {
      console.log(`SUCCESS: ${message}`);
    } else {
      failures.push(message);
      console.error(`FAIL: ${message}`);
    }
  };

  const getResponse = (urlPath, origin) => {
    return new Promise((resolve, reject) => {
      const headers = {};
      if (origin) headers['Origin'] = origin;
      
      const req = http.request({
        hostname: 'localhost',
        port: 3999,
        path: urlPath,
        method: 'GET',
        headers
      }, (res) => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers
        });
      });
      req.on('error', reject);
      req.end();
    });
  };

  try {
    // Test 1: Health endpoint headers
    const res = await getResponse('/api/health');
    const headers = res.headers;

    expect(headers['content-security-policy'] !== undefined, 'CSP header should be present');
    if (headers['content-security-policy']) {
      expect(headers['content-security-policy'].includes("default-src 'self'"), 'CSP should restrict default-src to self');
    }

    expect(headers['strict-transport-security'] !== undefined, 'HSTS header should be present in production');
    expect(headers['x-frame-options'] === 'DENY', 'X-Frame-Options should be DENY to prevent clickjacking');
    expect(headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options should be nosniff to prevent MIME sniffing');

    // Test 2: CORS allowed origin
    const corsAllowedRes = await getResponse('/api/health', 'http://allowed-frontend.com');
    expect(corsAllowedRes.headers['access-control-allow-origin'] === 'http://allowed-frontend.com', 'CORS should allow configured FRONTEND_URL');
    expect(corsAllowedRes.headers['access-control-allow-credentials'] === 'true', 'CORS should permit credentials');

    // Test 3: CORS disallowed origin
    const corsDisallowedRes = await getResponse('/api/health', 'http://hacker.com');
    // If disallowed, CORS middleware either errors out (which express handles) or does not set Access-Control-Allow-Origin header
    expect(corsDisallowedRes.headers['access-control-allow-origin'] !== 'http://hacker.com', 'CORS should deny unconfigured origins');

    if (failures.length > 0) {
      console.error(`\n❌ Security Headers validation failed with ${failures.length} errors.`);
      process.exit(1);
    } else {
      console.log('\n🎉 ALL SECURITY HEADERS AND CORS TESTS PASSED!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Test script crashed:', err.message);
    process.exit(1);
  }
}

runTests();
