/**
 * adminService — all admin API calls.
 *
 * The axios instance auto-attaches the JWT token via its interceptor,
 * so no manual token handling is needed here.
 */
import axiosInstance from '../lib/axios.js';

const BASE = '/admin';

export const adminService = {
  // ─── Dashboard ──────────────────────────────────────────────────────────
  getDashboardStats: () =>
    axiosInstance.get(`${BASE}/dashboard`).then((r) => r.data),

  // ─── Analytics ──────────────────────────────────────────────────────────
  getAnalytics: () =>
    axiosInstance.get(`${BASE}/analytics`).then((r) => r.data),

  getSalesAnalytics: () =>
    axiosInstance.get(`${BASE}/analytics/sales`).then((r) => r.data),

  getOrderAnalytics: () =>
    axiosInstance.get(`${BASE}/analytics/orders`).then((r) => r.data),

  getCustomerAnalytics: () =>
    axiosInstance.get(`${BASE}/analytics/customers`).then((r) => r.data),

  getProductAnalytics: () =>
    axiosInstance.get(`${BASE}/analytics/products`).then((r) => r.data),

  getFunnelAnalytics: () =>
    axiosInstance.get(`${BASE}/analytics/funnel`).then((r) => r.data),

  getOperationalMetrics: () =>
    axiosInstance.get(`${BASE}/analytics/operational`).then((r) => r.data),

  getSupplierAnalytics: (supplierId) => {
    const url = supplierId
      ? `${BASE}/supplier/analytics?supplier_id=${supplierId}`
      : `${BASE}/supplier/analytics`;
    return axiosInstance.get(url).then((r) => r.data);
  },

  getDashboardSummary: () =>
    axiosInstance.get(`${BASE}/analytics/dashboard-summary`).then((r) => r.data),

  // ─── Products ───────────────────────────────────────────────────────────
  getAllProducts: () =>
    axiosInstance.get(`${BASE}/products`).then((r) => r.data),

  updateProduct: (id, data) =>
    axiosInstance.put(`${BASE}/products/${id}`, data).then((r) => r.data),

  setProductStatus: (id, status) =>
    axiosInstance
      .patch(`${BASE}/products/${id}/status`, { status })
      .then((r) => r.data),

  uploadFile: (fileName, fileData) =>
    axiosInstance.post(`${BASE}/upload`, { fileName, fileData }).then((r) => r.data),

  duplicateProduct: (id) =>
    axiosInstance.post(`${BASE}/products/${id}/duplicate`).then((r) => r.data),

  // ─── Categories & Suppliers (product forms) ─────────────────────────────
  getCategories: () =>
    axiosInstance.get(`${BASE}/categories`).then((r) => r.data),

  getSuppliers: () =>
    axiosInstance.get(`${BASE}/suppliers`).then((r) => r.data),

  // ─── Orders ─────────────────────────────────────────────────────────────
  getAllOrders: () =>
    axiosInstance.get(`${BASE}/orders`).then((r) => r.data),

  getOrderById: (id) =>
    axiosInstance.get(`${BASE}/orders/${id}`).then((r) => r.data),

  updateOrderStatus: (id, status) =>
    axiosInstance
      .patch(`${BASE}/orders/${id}/status`, { status })
      .then((r) => r.data),

  // ─── Requests ───────────────────────────────────────────────────────────
  getAllRequests: () =>
    axiosInstance.get(`${BASE}/requests`).then((r) => r.data),

  handleRequest: (id, status, admin_note = '') =>
    axiosInstance
      .patch(`${BASE}/requests/${id}`, { status, admin_note })
      .then((r) => r.data),

  // ─── Returns ────────────────────────────────────────────────────────────
  getAllReturns: () =>
    axiosInstance.get('/admin/returns').then((r) => r.data),

  updateReturnStatus: (return_id, status, admin_notes = '') =>
    axiosInstance
      .patch(`/admin/returns/${return_id}/status`, { status, admin_notes })
      .then((r) => r.data),

  // ─── Customers ──────────────────────────────────────────────────────────
  getAllCustomers: () =>
    axiosInstance.get(`${BASE}/customers`).then((r) => r.data),

  getCustomerById: (id) =>
    axiosInstance.get(`${BASE}/customers/${id}`).then((r) => r.data),

  setCustomerStatus: (id, status) =>
    axiosInstance
      .patch(`${BASE}/customers/${id}/status`, { status })
      .then((r) => r.data),

  // ─── Reviews ────────────────────────────────────────────────────────────
  getAllReviews: () =>
    axiosInstance.get(`${BASE}/reviews`).then((r) => r.data),

  deleteReview: (id) =>
    axiosInstance.delete(`${BASE}/reviews/${id}`).then((r) => r.data),

  // ─── Inventory ──────────────────────────────────────────────────────────
  getInventory: () =>
    axiosInstance.get(`${BASE}/inventory`).then((r) => r.data),

  adjustInventory: (variant_id, movement_type, quantity, notes) =>
    axiosInstance
      .post(`${BASE}/inventory/adjust`, { variant_id, movement_type, quantity, notes })
      .then((r) => r.data),

  getInventoryHistoryByVariant: (variant_id) =>
    axiosInstance.get(`${BASE}/inventory/history/${variant_id}`).then((r) => r.data),

  getAlerts: () =>
    axiosInstance.get(`${BASE}/alerts`).then((r) => r.data),

  resolveAlert: (alert_id) =>
    axiosInstance.patch(`${BASE}/alerts/${alert_id}/resolve`).then((r) => r.data),

  // ─── Coupons ────────────────────────────────────────────────────────────
  getAllCoupons: () =>
    axiosInstance.get(`${BASE}/coupons`).then((r) => r.data),

  createCoupon: (payload) =>
    axiosInstance.post(`${BASE}/coupons`, payload).then((r) => r.data),

  updateCoupon: (id, payload) =>
    axiosInstance.patch(`${BASE}/coupons/${id}`, payload).then((r) => r.data),

  // ─── Purchase Orders ───────────────────────────────────────────────────
  getPurchaseOrders: () =>
    axiosInstance.get(`${BASE}/purchase-orders`).then((r) => r.data),

  createPurchaseOrder: (payload) =>
    axiosInstance.post(`${BASE}/purchase-orders`, payload).then((r) => r.data),

  getPurchaseOrderDetails: (id) =>
    axiosInstance.get(`${BASE}/purchase-orders/${id}`).then((r) => r.data),

  updatePurchaseOrderStatus: (id, status) =>
    axiosInstance.patch(`${BASE}/purchase-orders/${id}/status`, { status }).then((r) => r.data),

  receivePurchaseOrderInventory: (id, payload) =>
    axiosInstance.post(`${BASE}/purchase-orders/${id}/receive`, payload).then((r) => r.data),

  getSupplierPurchaseOrders: () =>
    axiosInstance.get('/supplier/purchase-orders').then((r) => r.data),

  getSupplierPurchaseOrderDetails: (id) =>
    axiosInstance.get(`/supplier/purchase-orders/${id}`).then((r) => r.data),

  acknowledgePurchaseOrder: (id) =>
    axiosInstance.patch(`/supplier/purchase-orders/${id}/acknowledge`).then((r) => r.data),

  getSupplierPerformance: () =>
    axiosInstance.get(`${BASE}/supplier-performance`).then((r) => r.data),

  getInventoryForecast: () =>
    axiosInstance.get(`${BASE}/inventory-forecast`).then((r) => r.data),

  getOperationsMetrics: () =>
    axiosInstance.get(`${BASE}/operations-metrics`).then((r) => r.data),
};
