import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ToastContainer } from './components/ui/Toast/ToastContainer.jsx';
import { ProtectedRoute } from './components/ui/ProtectedRoute/index.jsx';
import { ErrorBoundary } from './components/ui/ErrorBoundary/index.jsx';
import { useScrollRestoration } from './hooks/useScrollRestoration.js';
import { Spinner } from './components/ui/Spinner/index.jsx';
import { ROUTES } from './constants/routes.js';

// Eagerly loaded — critical first-render path
import Home from './pages/Home/index.jsx';

// ─── Lazy page modules — MUST be defined at module scope, never inside render ─
// Defining them here ensures React reuses the same lazy component across renders.
const LazyProductDetails = lazy(() => import('./pages/ProductDetails/index.jsx'));
const LazyLogin          = lazy(() => import('./pages/Login/index.jsx'));
const LazyRegister       = lazy(() => import('./pages/Register/index.jsx'));
const LazyCart           = lazy(() => import('./pages/Cart/index.jsx'));
const LazyCheckout       = lazy(() => import('./pages/Checkout/index.jsx'));
const LazyOrders         = lazy(() => import('./pages/Orders/index.jsx'));
const LazyOrderDetail    = lazy(() => import('./pages/OrderDetails/index.jsx'));
const LazyProfile        = lazy(() => import('./pages/Profile/index.jsx'));
const LazyOrderSuccess   = lazy(() => import('./pages/OrderSuccess/index.jsx'));
const LazyNotifications  = lazy(() => import('./pages/Notifications/index.jsx'));
const LazyNotFound       = lazy(() => import('./pages/NotFound/index.jsx'));

// Admin pages
const LazyAdminLayout    = lazy(() => import('./pages/Admin/AdminLayout/index.jsx'));
const LazyAdminDashboard = lazy(() => import('./pages/Admin/Dashboard/index.jsx'));
const LazyAdminProductList = lazy(() => import('./pages/Admin/Products/ProductList/index.jsx'));
const LazyAdminCreateProduct = lazy(() => import('./pages/Admin/Products/CreateProduct/index.jsx'));
const LazyAdminEditProduct = lazy(() => import('./pages/Admin/Products/EditProduct/index.jsx'));
const LazyAdminOrders      = lazy(() => import('./pages/Admin/Orders/index.jsx'));
const LazyAdminOrderDetail = lazy(() => import('./pages/Admin/Orders/OrderDetail/index.jsx'));
const LazyAdminRequests    = lazy(() => import('./pages/Admin/Requests/index.jsx'));
const LazyAdminReturns     = lazy(() => import('./pages/Admin/Returns/index.jsx'));
const LazyAdminAnalytics   = lazy(() => import('./pages/Admin/Analytics/index.jsx'));
const LazyAdminCustomers   = lazy(() => import('./pages/Admin/Customers/index.jsx'));
const LazyAdminCustomerDetail = lazy(() => import('./pages/Admin/Customers/CustomerDetail/index.jsx'));
const LazyAdminReviews     = lazy(() => import('./pages/Admin/Reviews/index.jsx'));
const LazyAdminCoupons     = lazy(() => import('./pages/Admin/Coupons/index.jsx'));
const LazyAdminInventory   = lazy(() => import('./pages/Admin/Inventory/index.jsx'));
const LazyAdminSettings    = lazy(() => import('./pages/Admin/Settings/index.jsx'));

// ─── Loading fallback ──────────────────────────────────────────────────────────
function PageLoadingFallback() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--color-text-muted)',
    }}>
      <Spinner size="lg" />
    </div>
  );
}

// ─── Lazy route wrapper — Suspense + ErrorBoundary per route ───────────────────
function LazyRoute({ element: Element }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoadingFallback />}>
        <Element />
      </Suspense>
    </ErrorBoundary>
  );
}

// ─── Route tree ───────────────────────────────────────────────────────────────
function AppRoutes() {
  useScrollRestoration();

  return (
    <Routes>
      {/* Public routes */}
      <Route path={ROUTES.HOME}            element={<Home />} />
      <Route path="/products"              element={<Home />} />
      <Route path={ROUTES.PRODUCT_DETAILS} element={<LazyRoute element={LazyProductDetails} />} />
      <Route path={ROUTES.LOGIN}           element={<LazyRoute element={LazyLogin} />} />
      <Route path={ROUTES.REGISTER}        element={<LazyRoute element={LazyRegister} />} />

      {/* Customer-protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTES.CART}     element={<LazyRoute element={LazyCart} />} />
        <Route path={ROUTES.CHECKOUT} element={<LazyRoute element={LazyCheckout} />} />
        <Route path={ROUTES.ORDERS}   element={<LazyRoute element={LazyOrders} />} />
        <Route path={ROUTES.ORDER_DETAILS} element={<LazyRoute element={LazyOrderDetail} />} />
        <Route path={ROUTES.PROFILE}  element={<LazyRoute element={LazyProfile} />} />
        <Route path={ROUTES.ORDER_SUCCESS} element={<LazyRoute element={LazyOrderSuccess} />} />
        <Route path={ROUTES.NOTIFICATIONS} element={<LazyRoute element={LazyNotifications} />} />
      </Route>

      {/* Shared Admin & Supplier dashboard routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'supplier']} />}>
        <Route element={<LazyRoute element={LazyAdminLayout} />}>
          <Route path={ROUTES.ADMIN_PRODUCTS}        element={<LazyRoute element={LazyAdminProductList} />} />
          <Route path={ROUTES.ADMIN_PRODUCTS_CREATE} element={<LazyRoute element={LazyAdminCreateProduct} />} />
          <Route path={ROUTES.ADMIN_PRODUCTS_EDIT}   element={<LazyRoute element={LazyAdminEditProduct} />} />
        </Route>
      </Route>

      {/* Admin-only dashboard routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<LazyRoute element={LazyAdminLayout} />}>
          <Route path={ROUTES.ADMIN}                 element={<LazyRoute element={LazyAdminDashboard} />} />
          <Route path={ROUTES.ADMIN_ANALYTICS}       element={<LazyRoute element={LazyAdminAnalytics} />} />
          <Route path={ROUTES.ADMIN_INVENTORY}       element={<LazyRoute element={LazyAdminInventory} />} />
          <Route path={ROUTES.ADMIN_ORDERS}          element={<LazyRoute element={LazyAdminOrders} />} />
          <Route path={ROUTES.ADMIN_ORDER_DETAIL}    element={<LazyRoute element={LazyAdminOrderDetail} />} />
          <Route path={ROUTES.ADMIN_REQUESTS}        element={<LazyRoute element={LazyAdminRequests} />} />
          <Route path={ROUTES.ADMIN_RETURNS}         element={<LazyRoute element={LazyAdminReturns} />} />
          <Route path={ROUTES.ADMIN_CUSTOMERS}       element={<LazyRoute element={LazyAdminCustomers} />} />
          <Route path={ROUTES.ADMIN_CUSTOMER_DETAIL} element={<LazyRoute element={LazyAdminCustomerDetail} />} />
          <Route path={ROUTES.ADMIN_REVIEWS}         element={<LazyRoute element={LazyAdminReviews} />} />
          <Route path={ROUTES.ADMIN_COUPONS}         element={<LazyRoute element={LazyAdminCoupons} />} />
          <Route path={ROUTES.ADMIN_SETTINGS}        element={<LazyRoute element={LazyAdminSettings} />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path={ROUTES.NOT_FOUND} element={<LazyRoute element={LazyNotFound} />} />
    </Routes>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <AppRoutes />
            <ToastContainer />
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}