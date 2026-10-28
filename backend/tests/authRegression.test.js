const http = require('http');
const jwt = require('jsonwebtoken');

const TEST_SECRET = 'REGRESSION_TEST_SECRET_KEY';

async function runTests() {
  console.log('Starting Authorization Regression & Isolation Tests...');

  // Configure port and env
  process.env.PORT = '3998';
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.DATABASE_PATH = 'ecommerce.sqlite';
  process.env.FRONTEND_URL = 'http://localhost:5173';

  // Start the server
  require('../index');

  // Give the server 1.5 seconds to initialize
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

  const generateToken = (userId, username, role) => {
    return jwt.sign({ userId, username, role }, TEST_SECRET);
  };

  const makeRequest = (method, urlPath, token, body = null) => {
    return new Promise((resolve, reject) => {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const req = http.request({
        hostname: 'localhost',
        port: 3998,
        path: urlPath,
        method: method,
        headers: headers
      }, (res) => {
        let responseBody = '';
        res.on('data', chunk => { responseBody += chunk; });
        res.on('end', () => {
          let json = {};
          try { json = JSON.parse(responseBody); } catch(e) {}
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: json
          });
        });
      });

      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  };

  const customerAToken = generateToken(100, 'CustomerA', 'customer');
  const supplierAToken = generateToken(10, 'SupplierA', 'supplier');
  const adminToken = generateToken(999, 'AdminUser', 'admin');

  try {
    // 1. Assert Customer Isolation: IDOR on admin endpoints
    const resAdminStats = await makeRequest('GET', '/admin/analytics', customerAToken);
    expect(resAdminStats.statusCode === 403, 'Customer accessing admin analytics should be 403 Forbidden');

    // Supplier accessing admin endpoint
    const resSupplierAdminStats = await makeRequest('GET', '/admin/analytics', supplierAToken);
    expect(resSupplierAdminStats.statusCode === 403, 'Supplier accessing admin analytics should be 403 Forbidden');

    // Admin accessing admin endpoint
    const resAdminStatsSuccess = await makeRequest('GET', '/admin/analytics', adminToken);
    expect(resAdminStatsSuccess.statusCode !== 403 && resAdminStatsSuccess.statusCode !== 401, 'Admin accessing admin analytics should not be Forbidden');

    // 2. Supplier Isolation: Supplier accessing customer wallet balance (only customer authorized)
    const resSupplierWallet = await makeRequest('GET', '/api/payments/wallet/balance', supplierAToken);
    // Customer routes accept all authenticated users generally, but let's check if the wallet routes are customer-only or check role.
    // Wait, the paymentRoutes has:
    // router.get('/wallet/balance', ...authGuard, paymentCtrl.getWalletBalance);
    // So authGuard allows all authenticated users (customer, supplier, admin).
    // Wait, let's verify if there is an endpoint restricted to customer only, or if we want to check that a customer cannot query another customer's balance.
    // The getWalletBalance uses req.userId to get the balance, so it inherently prevents IDOR because it loads the balance for req.userId!
    // Let's assert that a request with no token to a protected route returns 401:
    const resNoTokenWallet = await makeRequest('GET', '/api/payments/wallet/balance', null);
    expect(resNoTokenWallet.statusCode === 401, 'Unauthenticated access to wallet should be 401 Unauthorized');

    // 3. IDOR: Customer A accessing Customer B's order
    const resCustomerBOrder1 = await makeRequest('GET', '/orders/1', customerAToken);
    // If order 1 exists, customer A (user 100) owns it (placed_at and user_id=100 in database setup), so it should succeed.
    // If customer B (user 101) accesses order 1, they should get 403 Forbidden.
    const customerBToken = generateToken(101, 'CustomerB', 'customer');
    const resCustomerBOrder1Forbidden = await makeRequest('GET', '/orders/1', customerBToken);
    expect(resCustomerBOrder1Forbidden.statusCode === 403, 'Customer B accessing Customer A\'s order should be 403 Forbidden');

    // 4. Supplier Isolation on supplier analytics
    // /admin/supplier/analytics requires supplier or admin role. Let's make sure a customer gets 403:
    const resCustomerSupplierAnalytics = await makeRequest('GET', '/admin/supplier/analytics', customerAToken);
    expect(resCustomerSupplierAnalytics.statusCode === 403, 'Customer accessing supplier analytics should be 403 Forbidden');

    if (failures.length > 0) {
      console.error(`\n❌ Auth isolation tests failed with ${failures.length} issues.`);
      process.exit(1);
    } else {
      console.log('\n🎉 ALL AUTHORIZATION REGRESSION AND ISOLATION TESTS PASSED!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Auth isolation test crashed:', err.message);
    process.exit(1);
  }
}

runTests();
