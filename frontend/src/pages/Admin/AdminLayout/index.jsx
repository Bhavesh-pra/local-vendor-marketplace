import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ShoppingBag,
  Users,
  LogOut,
  Bell,
  Store,
  Menu,
  X,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth.js';
import { useToast } from '../../../hooks/useToast.js';
import { adminService } from '../../../services/adminService.js';
import { ROUTES } from '../../../constants/routes.js';
import './index.css';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: ROUTES.ADMIN,           end: true  },
  { label: 'Products',  icon: Package,          path: ROUTES.ADMIN_PRODUCTS              },
  { label: 'Inventory', icon: ClipboardList,    path: ROUTES.ADMIN_INVENTORY             },
  { label: 'Orders',    icon: ShoppingBag,       path: ROUTES.ADMIN_ORDERS               },
  { label: 'Customers', icon: Users,             path: ROUTES.ADMIN_CUSTOMERS            },
  { label: 'Settings',  icon: Settings,          path: ROUTES.ADMIN_SETTINGS             },
];

/**
 * AdminLayout — the persistent shell for all /admin/* pages.
 * Renders: sidebar (brand + nav + logout) + header (bell + user) + <Outlet />.
 * Fetches pending request count for the notification badge.
 */
export default function AdminLayout() {
  const { user, clearUser } = useAuth();
  const { showToast }       = useToast();
  const navigate             = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [sidebarOpen, setSidebarOpen]   = useState(false);

  // Fetch pending request count for notification badge
  useEffect(() => {
    if (user?.role === 'admin') {
      adminService.getDashboardStats()
        .then((data) => setPendingCount(data.stats?.pendingRequests ?? 0))
        .catch(() => {/* non-critical — badge stays at 0 */});
    }
  }, [user]);

  const handleLogout = () => {
    clearUser();
    showToast('success', 'Signed out successfully');
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <div className="al-root">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="al-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`al-sidebar ${sidebarOpen ? 'al-sidebar--open' : ''}`}>
        {/* Brand */}
        <div className="al-brand">
          <div className="al-brand__icon">
            <Store size={18} />
          </div>
          <div className="al-brand__text">
            <span className="al-brand__name">ShopCart</span>
            <span className="al-brand__role">Admin Console</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="al-nav" aria-label="Admin navigation">
          {(() => {
            const role = user?.role || 'admin';
            const filteredNavItems = NAV_ITEMS.filter(item => {
              if (role === 'supplier') {
                return item.path === ROUTES.ADMIN_PRODUCTS;
              }
              return true;
            });
            return filteredNavItems.map(({ label, icon: Icon, path, end, badge }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `al-nav__item${isActive ? ' al-nav__item--active' : ''}`
                }
              >
                <Icon size={17} className="al-nav__icon" />
                <span className="al-nav__label">{label}</span>
                {badge && pendingCount > 0 && (
                  <span className="al-nav__badge" aria-label={`${pendingCount} pending`}>
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </NavLink>
            ));
          })()}
        </nav>

        {/* Logout */}
        <button
          className="al-logout"
          onClick={handleLogout}
          aria-label="Sign out"
        >
          <LogOut size={17} />
          <span>Sign Out</span>
        </button>
      </aside>

      {/* ── Main area ── */}
      <div className="al-main">
        {/* Top header */}
        <header className="al-header">
          <button
            className="al-header__menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="al-header__right">
            {/* Notification bell */}
            {user?.role === 'admin' && (
              <button
                className="al-header__bell"
                onClick={() => navigate(ROUTES.ADMIN_REQUESTS)}
                aria-label={`${pendingCount} pending requests`}
                title="Pending Requests"
              >
                <Bell size={18} />
                {pendingCount > 0 && (
                  <span className="al-header__bell-dot" aria-hidden="true">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}

            {/* Admin user chip */}
            <div className="al-header__user" aria-label="Signed in as admin">
              <div className="al-header__avatar" aria-hidden="true">
                {(user?.username?.[0] ?? 'A').toUpperCase()}
              </div>
              <span className="al-header__uname">{user?.username ?? 'Admin'}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="al-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
