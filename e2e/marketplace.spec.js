const { test, expect } = require('@playwright/test');

test.describe('Local Vendor Marketplace E2E Journeys', () => {
  const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

  test('Customer lifecycle: register, login, browse, cart, checkout & payment', async ({ page }) => {
    // 1. Registration
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="username"]', 'E2ETester');
    await page.fill('input[name="email"]', 'e2e@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // 2. Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'e2e@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // 3. Product Browsing & Details
    await page.goto(`${BASE_URL}/`);
    await page.waitForSelector('.product-card');
    await page.click('.product-card:first-child');
    await page.waitForSelector('.product-details');

    // 4. Cart Management
    await page.click('button:has-text("Add to Cart")');
    await page.goto(`${BASE_URL}/cart`);
    await expect(page.locator('.cart-item')).toHaveCount(1);

    // 5. Checkout
    await page.click('button:has-text("Proceed to Checkout")');
    await page.waitForSelector('.checkout-form');
    await page.fill('input[name="address"]', '123 E2E Lane');
    await page.fill('input[name="phone"]', '1234567890');
    await page.click('button:has-text("Place Order")');

    // 6. Payment (Mock interface)
    await page.waitForSelector('.payment-gateway');
    await page.click('button:has-text("Pay Now")');
    await expect(page).toHaveURL(/.*order-success.*/);
  });

  test('Supplier and Admin Analytics Dashboards', async ({ page }) => {
    // Login as Admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'admin@marketplace.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Verify Admin Analytics Dashboard
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForSelector('.analytics-metrics');
    await expect(page.locator('.revenue-card')).toBeVisible();

    // Verify Supplier Dashboard
    await page.goto(`${BASE_URL}/supplier/dashboard`);
    await page.waitForSelector('.supplier-stats');
    await expect(page.locator('.payouts-card')).toBeVisible();
  });
});
