import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ShoppingBag,
  Users,
  LogOut,
  Store,
  Menu,
  Settings,
  RefreshCw,
  Tag,
  FileText,
  TrendingUp,
  UserCheck,
  Activity,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth.js';
import { useToast } from '../../../hooks/useToast.js';
import { adminService } from '../../../services/adminService.js';
import { ROUTES } from '../../../constants/routes.js';
import './index.css';

/** Nav grouped by business function — easier to scan than 14 flat items */
const NAV_GROUPS = [
  {
    group: null,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: ROUTES.ADMIN, end: true },
    ],
  },
  {
    group: 'Commerce',
    items: [
      { label: 'Orders',    icon: ShoppingBag,  path: ROUTES.ADMIN_ORDERS    },
      { label: 'Returns',   icon: RefreshCw,    path: ROUTES.ADMIN_RETURNS   },
      { label: 'Customers', icon: Users,         path: ROUTES.ADMIN_CUSTOMERS },
      { label: 'Coupons',   icon: Tag,           path: ROUTES.ADMIN_COUPONS  },
    ],
  },
  {
    group: 'Catalog',
    items: [
      { label: 'Products',        icon: Package,       path: ROUTES.ADMIN_PRODUCTS        },
      { label: 'Inventory',       icon: ClipboardList, path: ROUTES.ADMIN_INVENTORY       },
      { label: 'Purchase Orders', icon: FileText,      path: ROUTES.ADMIN_PURCHASE_ORDERS },
    ],
  },
  {
    group: 'Finance & Analytics',
    items: [
      { label: 'Finance Center',     icon: Landmark,   path: ROUTES.ADMIN_FINANCE              },
      { label: 'Analytics',          icon: TrendingUp, path: ROUTES.ADMIN_ANALYTICS            },
      { label: 'Supplier Perf.',     icon: UserCheck,  path: ROUTES.ADMIN_SUPPLIER_PERFORMANCE },
      { label: 'Inventory Forecast', icon: TrendingUp, path: ROUTES.ADMIN_INVENTORY_FORECAST   },
      { label: 'Ops Metrics',        icon: Activity,   path: ROUTES.ADMIN_OPERATIONS_METRICS   },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'Settings', icon: Settings, path: ROUTES.ADMIN_SETTINGS },
    ],
  },
];

/**
 * AdminLayout — the persistent shell for all /admin/* pages.
 * Renders: sidebar (brand + grouped nav + logout) + header + <Outlet />.
 * Fetches pending request count for the notification badge.
 */
export default function AdminLayout() {
  const { user, clearUser } = useAuth();
  const { showToast }       = useToast();
  const navigate             = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [sidebarOpen, setSidebarOpen]   = useState(false);

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

  const role = user?.role || 'admin';

  // Build visible groups, remapping supplier paths where needed and stripping non-supplier items
  const visibleGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.map(item => {
      if (item.path === ROUTES.ADMIN_PURCHASE_ORDERS && role === 'supplier') {
        return { ...item, path: ROUTES.SUPPLIER_PURCHASE_ORDERS };
      }
      if (item.path === ROUTES.ADMIN_ANALYTICS && role === 'supplier') {
        return { ...item, path: ROUTES.SUPPLIER_ANALYTICS };
      }
      return item;
    }).filter(item => {
      if (role === 'supplier') {
        return item.path === ROUTES.ADMIN_PRODUCTS ||
               item.path === ROUTES.SUPPLIER_PURCHASE_ORDERS ||
               item.path === ROUTES.SUPPLIER_ANALYTICS;
      }
      return true;
    }),
  })).filter(group => group.items.length > 0);

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

        {/* Grouped Navigation */}
        <nav className="al-nav" aria-label="Admin navigation">
          {visibleGroups.map((group, gi) => (
            <div key={gi} className="al-nav__group">
              {group.group && (
                <div className="al-nav__group-label">{group.group}</div>
              )}
              {group.items.map(({ label, icon: Icon, path, end, badge }) => (
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
              ))}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="al-sidebar__footer">
          <button
            className="al-logout-btn"
            onClick={handleLogout}
            type="button"
            id="admin-logout-btn"
            aria-label="Logout"
          >
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="al-main">
        {/* Top Header */}
        <header className="al-header">
          <button
            className="al-header__hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            type="button"
          >
            <Menu size={22} />
          </button>
          <div className="al-header__right">
            <div className="al-header__user">
              <div className="al-header__avatar" aria-hidden="true">
                {user?.username?.charAt(0)?.toUpperCase() ?? 'A'}
              </div>
              <div className="al-header__user-info">
                <span className="al-header__username">{user?.username}</span>
                <span className="al-header__role">{user?.role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="al-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
