import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  DollarSign,
  ClipboardList,
  ShoppingBag,
  RefreshCw,
  ArrowRightLeft,
  Users,
  Plus
} from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { useToast } from '../../../hooks/useToast.js';
import { ROUTES } from '../../../constants/routes.js';
import { getCustomerType } from '../../../utils/customerHelper.js';
import './index.css';

/* ── Stat card config ──────────────────────────────────────────────────── */
const STAT_CONFIG = [
  {
    key: 'revenue',
    label: 'Total Revenue',
    icon: TrendingUp,
    color: 'hsl(162, 73%, 46%)',
    bg: 'hsla(162,73%,46%,0.1)',
    format: (v) =>
      `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
  },
  {
    key: 'products',
    label: 'Products',
    icon: Package,
    color: 'hsl(243, 75%, 65%)',
    bg: 'hsla(243,75%,65%,0.1)',
    format: (v) => Number(v).toLocaleString('en-IN'),
  },
  {
    key: 'inventoryValue',
    label: 'Inventory Value',
    icon: DollarSign,
    color: 'hsl(38, 88%, 52%)',
    bg: 'hsla(38,88%,52%,0.1)',
    format: (v) =>
      `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
    link: ROUTES.ADMIN_INVENTORY
  },
  {
    key: 'stockAlerts',
    label: 'Stock Alerts',
    icon: AlertTriangle,
    color: 'hsl(27, 90%, 55%)',
    bg: 'hsla(27,90%,55%,0.1)',
    format: (v) => Number(v).toLocaleString('en-IN'),
    link: ROUTES.ADMIN_INVENTORY
  },
  {
    key: 'lowStockCount',
    label: 'Low Stock Count',
    icon: ClipboardList,
    color: 'hsl(0, 80%, 62%)',
    bg: 'hsla(0,80%,62%,0.1)',
    format: (v) => Number(v).toLocaleString('en-IN'),
    link: ROUTES.ADMIN_INVENTORY
  },
  {
    key: 'pendingOrdersCount',
    label: 'Pending Orders',
    icon: ShoppingBag,
    color: 'hsl(198, 85%, 48%)',
    bg: 'hsla(198,85%,48%,0.1)',
    format: (v) => Number(v).toLocaleString('en-IN'),
    link: ROUTES.ADMIN_ORDERS
  },
  {
    key: 'processingOrdersCount',
    label: 'Processing Orders',
    icon: RefreshCw,
    color: 'hsl(270, 72%, 68%)',
    bg: 'hsla(270,72%,68%,0.1)',
    format: (v) => Number(v).toLocaleString('en-IN'),
    link: ROUTES.ADMIN_ORDERS
  },
  {
    key: 'returnedOrdersCount',
    label: 'Returned Orders',
    icon: ArrowRightLeft,
    color: 'hsl(27, 90%, 55%)',
    bg: 'hsla(27,90%,55%,0.1)',
    format: (v) => Number(v).toLocaleString('en-IN'),
    link: ROUTES.ADMIN_ORDERS
  },
];

/* ── Order status badge ────────────────────────────────────────────────── */
function orderBadge(status) {
  const map = {
    pending:          { cls: 'ap-badge--yellow', label: 'Pending' },
    processing:       { cls: 'ap-badge--blue',   label: 'Processing' },
    shipped:          { cls: 'ap-badge--purple', label: 'Shipped' },
    delivered:        { cls: 'ap-badge--green',  label: 'Delivered' },
    cancelled:        { cls: 'ap-badge--red',    label: 'Cancelled' },
    returned:         { cls: 'ap-badge--orange', label: 'Returned' },
  };
  const { cls, label } = map[status] ?? { cls: 'ap-badge--gray', label: status };
  return <span className={`ap-badge ${cls}`} style={{ textTransform: 'capitalize' }}>{label}</span>;
}

/* ── Format date ───────────────────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ── Format currency ───────────────────────────────────────────────────── */
function fmtCurrency(v) {
  return `₹${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function Dashboard() {
  useDocumentTitle('Dashboard — ShopCart Admin');
  const { showToast } = useToast();

  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [stats, setStats]                   = useState({});
  const [recentOrders, setRecentOrders]     = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [alerts, setAlerts]                 = useState([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardData, invValueData, alertsData] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getInventoryValue(),
        adminService.getAlerts(),
      ]);

      setStats({
        ...dashboardData.stats,
        inventoryValue: invValueData.total_cost_value,
      });
      setRecentOrders(dashboardData.recentOrders ?? []);
      setRecentCustomers(dashboardData.recentCustomers ?? []);
      setAlerts(alertsData ?? []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleResolveAlert = async (alertId) => {
    try {
      await adminService.resolveAlert(alertId);
      showToast('success', 'Alert resolved successfully');
      setAlerts(prev => prev.filter(a => a.alert_id !== alertId));
      setStats(prev => ({
        ...prev,
        stockAlerts: Math.max(0, (prev.stockAlerts ?? 1) - 1),
      }));
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to resolve alert');
      showToast('error', errMsg);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="ap-loading">
        <Spinner size="md" />
        <span>Loading dashboard…</span>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="ap-empty">
        <p className="ap-empty__title">Something went wrong</p>
        <p className="ap-empty__desc">{error}</p>
        <button className="ap-btn ap-btn--primary" onClick={fetchDashboardData} style={{ marginTop: '12px' }}>
          Retry
        </button>
      </div>
    );
  }

  const lowStockVal = Number(stats.lowStockCount || 0);
  const pendingOrdersVal = Number(stats.pendingOrdersCount || 0);
  const returnedOrdersVal = Number(stats.returnedOrdersCount || 0);
  const hasActionableIssue = (lowStockVal > 0 || pendingOrdersVal > 0 || returnedOrdersVal > 0);

  return (
    <div className="dashboard">
      {/* ── Page header ── */}
      <div className="ap-header">
        <h1 className="ap-title">Dashboard</h1>
        <p className="ap-subtitle">Welcome back — here's what's happening today.</p>
      </div>

      {/* ── Conditional Attention Required and Quick Actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: hasActionableIssue ? '1fr 1fr' : '1fr', gap: '24px', marginBottom: '28px' }}>
        {hasActionableIssue && (
          <div className="ap-card attention-required-card" style={{
            background: 'hsla(0, 84%, 60%, 0.04)',
            borderColor: 'hsla(0, 84%, 60%, 0.25)',
            borderLeft: '4px solid var(--color-status-error, #f43f5e)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '20px 24px',
            borderRadius: 'var(--radius-xl)'
          }}>
            <h3 style={{ color: 'hsl(0, 84%, 65%)', fontSize: '1.05rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 0' }}>
              <AlertTriangle size={18} />
              Attention Required
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: 'var(--color-text-body)' }}>
              {lowStockVal > 0 && (
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'hsl(0, 84%, 60%)' }}></span>
                  <span>{lowStockVal} Low Stock Product{lowStockVal !== 1 ? 's' : ''}</span>
                </li>
              )}
              {pendingOrdersVal > 0 && (
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'hsl(0, 84%, 60%)' }}></span>
                  <span>{pendingOrdersVal} Pending Order{pendingOrdersVal !== 1 ? 's' : ''}</span>
                </li>
              )}
              {returnedOrdersVal > 0 && (
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'hsl(0, 84%, 60%)' }}></span>
                  <span>{returnedOrdersVal} Return{returnedOrdersVal !== 1 ? 's' : ''}</span>
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="ap-card quick-actions-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 className="ap-section-title" style={{ fontSize: '0.9375rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', borderBottom: 'none', paddingBottom: 0 }}>
            Quick Actions
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link to={ROUTES.ADMIN_PRODUCTS_CREATE} className="ap-btn ap-btn--primary" style={{ textDecoration: 'none' }}>
              <Plus size={15} style={{ marginRight: '4px' }} />
              <span>Create Product</span>
            </Link>
            <Link to={ROUTES.ADMIN_ORDERS} className="ap-btn ap-btn--ghost" style={{ textDecoration: 'none' }}>
              <ShoppingBag size={15} style={{ marginRight: '4px' }} />
              <span>View Orders</span>
            </Link>
            <Link to={ROUTES.ADMIN_INVENTORY} className="ap-btn ap-btn--ghost" style={{ textDecoration: 'none' }}>
              <ClipboardList size={15} style={{ marginRight: '4px' }} />
              <span>Open Inventory</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="ap-stats-grid">
        {STAT_CONFIG.map(({ key, label, icon: Icon, color, bg, format, link }) => {
          const CardComponent = link ? Link : 'div';
          return (
            <CardComponent
              key={key}
              to={link}
              className="ap-stat-card"
              style={{ 
                '--stat-color': color, 
                '--stat-bg': bg,
                cursor: link ? 'pointer' : 'default',
                textDecoration: 'none'
              }}
            >
              <div className="ap-stat-card__top">
                <div className="ap-stat-card__icon" aria-hidden="true">
                  <Icon size={20} />
                </div>
              </div>
              <p className="ap-stat-card__label">{label}</p>
              <p className="ap-stat-card__value">
                {stats[key] !== undefined ? format(stats[key]) : '—'}
              </p>
            </CardComponent>
          );
        })}
      </div>

      {/* ── Recent Activity grid ── */}
      <div className="dashboard__grid">
        {/* Left Side: Recent Orders */}
        <div className="ap-card">
          <div className="dashboard__section-header">
            <p className="ap-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
              Recent Orders
            </p>
            <Link to={ROUTES.ADMIN_ORDERS} className="dashboard__link">
              View all →
            </Link>
          </div>
          <div className="ap-table-wrap" style={{ marginTop: '16px' }}>
            {recentOrders.length === 0 ? (
              <p className="ap-empty__desc" style={{ padding: '24px 0', textAlign: 'center' }}>
                No recent orders.
              </p>
            ) : (
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.order_id ?? order.id}>
                      <td className="dashboard__order-id" style={{ fontWeight: '700', fontFamily: 'monospace' }}>
                        #{(order.order_number || order.order_id) ?? order.id}
                      </td>
                      <td>{order.customer_name ?? order.username ?? '—'}</td>
                      <td>{fmtCurrency(order.total_amount ?? order.amount)}</td>
                      <td>{orderBadge(order.status)}</td>
                      <td className="dashboard__date">
                        {fmtDate(order.placed_at ?? order.created_at ?? order.date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: Active Alerts & Recent Customers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Alerts */}
          <div className="ap-card">
            <div className="dashboard__section-header">
              <p className="ap-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                Active Alerts
              </p>
              <Link to={ROUTES.ADMIN_INVENTORY} className="dashboard__link">
                Manage Inventory →
              </Link>
            </div>
            <div className="dashboard__alerts-list" style={{ marginTop: '16px' }}>
              {alerts.length === 0 ? (
                <p className="ap-empty__desc" style={{ padding: '24px 0', textAlign: 'center' }}>
                  No active stock alerts.
                </p>
              ) : (
                alerts.slice(0, 5).map((alert) => (
                  <div key={alert.alert_id} className={`dashboard__alert-item severity--${alert.severity}`}>
                    <div className="dashboard__alert-info">
                      <div className="dashboard__alert-msg">{alert.message}</div>
                      <div className="dashboard__alert-meta">
                        SKU: {alert.sku || '—'} • {new Date(alert.created_at).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                    <button
                      className="ap-btn ap-btn--ghost"
                      onClick={() => handleResolveAlert(alert.alert_id)}
                      style={{ padding: '4px 8px', fontSize: '11px', height: 'auto', minHeight: 'unset' }}
                    >
                      Resolve
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Customers widget */}
          <div className="ap-card">
            <div className="dashboard__section-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <p className="ap-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                Recent Customers
              </p>
              <span className="ap-badge ap-badge--green" style={{ fontSize: '11px', fontWeight: '700' }}>
                +{stats.newCustomersThisWeek || 0} New This Week
              </span>
            </div>
            
            <div className="dashboard__customers-list" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {recentCustomers.length === 0 ? (
                <p className="ap-empty__desc" style={{ padding: '16px 0', textAlign: 'center' }}>
                  No customer registrations.
                </p>
              ) : (
                recentCustomers.map((cust) => {
                  const customerType = getCustomerType(cust.order_count, cust.total_spending);
                  return (
                    <div key={cust.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border-subtle)', lastChild: { borderBottom: 'none' } }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'var(--color-surface-elevated)',
                          border: '1px solid var(--color-border-default)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '14px',
                          color: 'var(--color-brand-secondary)'
                        }}>
                          {cust.username ? cust.username.slice(0, 2).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <Link to={`/admin/customers/${cust.user_id}`} style={{ fontWeight: '600', fontSize: '14px', color: 'var(--color-text-heading)', textDecoration: 'none' }}>
                            {cust.username}
                          </Link>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            Joined {new Date(cust.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className={`ap-badge ${customerType.badgeClass}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                          {customerType.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
