/** Application route paths — all navigation uses these constants */
export const ROUTES = {
  HOME:            '/',
  PRODUCT_DETAILS: '/products/:productId',
  CART:            '/cart',
  CHECKOUT:        '/checkout',
  LOGIN:           '/login',
  REGISTER:        '/register',
  ORDERS:          '/orders',
  ORDER_DETAILS:   '/orders/:id',
  PROFILE:         '/profile',
  ORDER_SUCCESS:   '/order-success/:orderId',
  NOTIFICATIONS:   '/notifications',
  ADD_PRODUCT:     '/add-product',
  NOT_FOUND:       '*',

  // ─── Admin ─────────────────────────────────────────────────────────────
  ADMIN:                 '/admin',
  ADMIN_ANALYTICS:       '/admin/analytics',
  ADMIN_PRODUCTS:        '/admin/products',
  ADMIN_PRODUCTS_CREATE: '/admin/products/create',
  ADMIN_PRODUCTS_EDIT:   '/admin/products/:id/edit',
  ADMIN_INVENTORY:       '/admin/inventory',
  ADMIN_ORDERS:          '/admin/orders',
  ADMIN_ORDER_DETAIL:    '/admin/orders/:id',
  ADMIN_REQUESTS:        '/admin/requests',
  ADMIN_RETURNS:         '/admin/returns',
  ADMIN_CUSTOMERS:       '/admin/customers',
  ADMIN_CUSTOMER_DETAIL: '/admin/customers/:id',
  ADMIN_REVIEWS:         '/admin/reviews',
  ADMIN_COUPONS:         '/admin/coupons',
  ADMIN_SETTINGS:        '/admin/settings',
};

/**
 * Build a concrete product details URL from a product ID.
 * @param {number|string} productId
 * @returns {string}
 */
export function productPath(productId) {
  return `/products/${productId}`;
}
