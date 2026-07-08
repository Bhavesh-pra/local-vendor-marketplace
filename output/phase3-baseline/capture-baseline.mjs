import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = 'http://127.0.0.1:4173';
const apiBase = 'http://localhost:3000';
const productId = 13;

const viewports = [
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
  { name: '360x800', width: 360, height: 800, mobile: true },
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '412x915', width: 412, height: 915, mobile: true },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function screenshotPage(page, filePath, opts = {}) {
  await ensureDir(path.dirname(filePath));
  await page.screenshot({ path: filePath, animations: 'disabled', ...opts });
}

async function setField(page, selector, value) {
  const field = page.locator(selector);
  const tagName = await field.evaluate((el) => el.tagName.toLowerCase());
  if (tagName === 'select') {
    try {
      await field.selectOption({ label: value });
      return;
    } catch {
      await field.selectOption({ value });
      return;
    }
  }
  await field.fill(value);
}

async function registerAndLogin(tag) {
  const username = `Phase3 ${tag} ${Date.now()}`;
  const email = `phase3.${tag}.${Date.now()}@example.com`;
  const password = 'ShopCart!23';

  const registerRes = await fetch(`${apiBase}/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  if (!registerRes.ok) {
    const text = await registerRes.text();
    throw new Error(`Register failed for ${email}: ${registerRes.status} ${text}`);
  }

  const loginRes = await fetch(`${apiBase}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login failed for ${email}: ${loginRes.status} ${text}`);
  }

  const loginData = await loginRes.json();
  return {
    credentials: { username, email, password },
    authState: {
      token: loginData.jwtToken,
      user: {
        userId: loginData.userId,
        username: loginData.username,
        role: loginData.role,
      },
    },
  };
}

async function createContext(browser, viewport) {
  return browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
    deviceScaleFactor: viewport.mobile ? 2 : 1,
  });
}

async function capturePublicSet(browser, viewport, baseDir) {
  const context = await createContext(browser, viewport);
  const page = await context.newPage();

  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await screenshotPage(page, path.join(baseDir, 'home-top.png'));

  const header = page.locator('header');
  await header.screenshot({ path: path.join(baseDir, 'header.png'), animations: 'disabled' });

  const footer = page.locator('footer');
  await footer.scrollIntoViewIfNeeded();
  await footer.screenshot({ path: path.join(baseDir, 'footer.png'), animations: 'disabled' });

  await page.locator('.home-layout').scrollIntoViewIfNeeded();
  await screenshotPage(page, path.join(baseDir, 'product-listing.png'));

  await page.goto(`${baseURL}/products/${productId}`, { waitUntil: 'networkidle' });
  await screenshotPage(page, path.join(baseDir, 'product-details.png'));

  await context.close();
}

async function captureAuthSet(browser, viewport, baseDir) {
  const { authState, credentials } = await registerAndLogin(viewport.name);

  const context = await createContext(browser, viewport);
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', JSON.stringify(token));
    localStorage.setItem('user', JSON.stringify(user));
  }, authState);

  const page = await context.newPage();

  await page.goto(`${baseURL}/products/${productId}`, { waitUntil: 'networkidle' });
  const addToCart = page.locator('.buy-box-btn.add-to-cart-btn');
  await addToCart.click();
  await page.waitForTimeout(1000);

  await page.goto(`${baseURL}/cart`, { waitUntil: 'networkidle' });
  await screenshotPage(page, path.join(baseDir, 'cart.png'));

  await page.goto(`${baseURL}/checkout`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(250);
  await screenshotPage(page, path.join(baseDir, 'checkout.png'));

  await page.fill('#name', authState.user.username);
  await page.fill('#phone', '9876543210');
  await page.fill('#email', credentials.email);
  await page.fill('#addressLine1', '221B Sample Street');
  await page.fill('#addressLine2', 'Unit 4');
  await page.fill('#city', 'Bengaluru');
  await setField(page, '#state', 'Karnataka');
  await page.fill('#pincode', '560001');
  await page.fill('#notes', 'Leave at reception.');

  const cartsRes = await fetch(`${apiBase}/carts/`, {
    headers: {
      Authorization: `Bearer ${authState.token}`,
    },
  });

  if (!cartsRes.ok) {
    const text = await cartsRes.text();
    throw new Error(`Unable to load carts: ${cartsRes.status} ${text}`);
  }

  const cartsData = await cartsRes.json();
  const cartsList = Array.isArray(cartsData) ? cartsData : cartsData?.carts ?? [];
  const activeCart = cartsList.find((c) => c.status === 'active');
  if (!activeCart?.cart_id) {
    throw new Error('Could not find an active cart for order placement.');
  }

  const orderPayload = {
    cart_id: activeCart.cart_id,
    name: authState.user.username,
    email: credentials.email,
    address: '221B Sample Street, Unit 4, Bengaluru, Karnataka - 560001',
    phone: '9876543210',
    paymentMethod: 'COD',
    notes: 'Leave at reception.',
  };

  const placeOrderRes = await fetch(`${apiBase}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authState.token}`,
    },
    body: JSON.stringify(orderPayload),
  });

  if (!placeOrderRes.ok) {
    const text = await placeOrderRes.text();
    throw new Error(`Order placement failed: ${placeOrderRes.status} ${text}`);
  }

  const placeOrderData = await placeOrderRes.json();
  const orderId = placeOrderData.order_id;
  if (!orderId) {
    throw new Error(`Order placement response did not include an order_id: ${JSON.stringify(placeOrderData)}`);
  }

  await page.goto(`${baseURL}/order-success/${orderId}`, { waitUntil: 'networkidle' });
  await screenshotPage(page, path.join(baseDir, 'order-success.png'));

  await page.goto(`${baseURL}/orders`, { waitUntil: 'networkidle' });
  await screenshotPage(page, path.join(baseDir, 'orders.png'));

  await page.goto(`${baseURL}/orders/${orderId}`, { waitUntil: 'networkidle' });
  await screenshotPage(page, path.join(baseDir, 'order-details.png'));

  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const rootDir = path.join(process.cwd(), 'output', 'phase3-baseline');
  await ensureDir(rootDir);

  for (const viewport of viewports) {
    const dir = path.join(rootDir, viewport.name);
    await ensureDir(dir);
    console.log(`Capturing ${viewport.name}...`);
    await capturePublicSet(browser, viewport, dir);
    await captureAuthSet(browser, viewport, dir);
  }

  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
