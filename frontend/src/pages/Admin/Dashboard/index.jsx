import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  DollarSign,
  ShoppingBag,
  RefreshCw,
  Star,
  Users,
  Activity,
  AlertCircle
} from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { ROUTES } from '../../../constants/routes.js';
import './index.css';

/* ── Format Currency ── */
function fmtCurrency(v) {
  return `₹${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function Dashboard() {
  useDocumentTitle('Dashboard — ShopCart Admin');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const dashboardData = await adminService.getDashboardSummary();
      setData(dashboardData);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="ap-loading" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <Spinner size="md" />
        <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Loading dashboard…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ap-empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p className="ap-empty__title" style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-status-error)' }}>Something went wrong</p>
        <p className="ap-empty__desc" style={{ fontSize: '14px', margin: '8px 0 16px' }}>{error || 'Failed to load summary.'}</p>
        <button className="ap-btn ap-btn--primary" onClick={fetchDashboardData} style={{ minHeight: '44px', padding: '0 24px' }}>
          Retry
        </button>
      </div>
    );
  }

  const { kpis = {}, leaderboards = {}, alerts = [] } = data;

  return (
    <div className="dashboard" style={{ paddingBottom: '40px' }}>
      {/* ── Page Header ── */}
      <div className="ap-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="ap-title" style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-text-heading)' }}>Dashboard</h1>
          <p className="ap-subtitle" style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Real-time visibility layer for operations.
          </p>
        </div>
      </div>

      {/* ── ALERTS SECTION ── */}
      {alerts.length > 0 && (
        <div className="dashboard__alerts" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-status-warning)', fontWeight: '600', fontSize: '15px' }}>
            <AlertCircle size={18} />
            <span>Urgent Operational Alerts ({alerts.length})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className="ap-card"
                style={{
                  padding: '12px 16px',
                  borderLeft: '4px solid var(--color-status-warning)',
                  backgroundColor: 'var(--color-surface-raised)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '13px',
                  lineHeight: '1.4'
                }}
              >
                <AlertTriangle size={16} style={{ color: 'var(--color-status-warning)', flexShrink: 0 }} />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI SECTION ── */}
      <div className="ap-stats-grid" style={{ marginBottom: '32px' }}>
        {/* KPI 1: Revenue Today */}
        <div className="ap-stat-card" style={{ '--stat-color': 'hsl(162, 73%, 46%)', '--stat-bg': 'hsla(162, 73%, 46%, 0.1)' }}>
          <div className="ap-stat-card__top">
            <div className="ap-stat-card__icon" aria-hidden="true">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="ap-stat-card__label">Revenue Today</p>
          <p className="ap-stat-card__value">{fmtCurrency(kpis.revenue_today)}</p>
        </div>

        {/* KPI 2: Pending Requests */}
        <Link to={ROUTES.ADMIN_REQUESTS} className="ap-stat-card" style={{ '--stat-color': 'hsl(38, 88%, 52%)', '--stat-bg': 'hsla(38, 88%, 52%, 0.1)', cursor: 'pointer', textDecoration: 'none' }}>
          <div className="ap-stat-card__top">
            <div className="ap-stat-card__icon" aria-hidden="true">
              <RefreshCw size={20} />
            </div>
          </div>
          <p className="ap-stat-card__label">Pending Requests</p>
          <p className="ap-stat-card__value">{Number(kpis.pending_requests ?? 0).toLocaleString('en-IN')}</p>
        </Link>

        {/* KPI 3: Low Stock Count */}
        <Link to={ROUTES.ADMIN_INVENTORY} className="ap-stat-card" style={{ '--stat-color': 'hsl(0, 80%, 62%)', '--stat-bg': 'hsla(0, 80%, 62%, 0.1)', cursor: 'pointer', textDecoration: 'none' }}>
          <div className="ap-stat-card__top">
            <div className="ap-stat-card__icon" aria-hidden="true">
              <Package size={20} />
            </div>
          </div>
          <p className="ap-stat-card__label">Low Stock Items</p>
          <p className="ap-stat-card__value">{Number(kpis.low_stock_count ?? 0).toLocaleString('en-IN')}</p>
        </Link>

        {/* KPI 4: Total Orders */}
        <Link to={ROUTES.ADMIN_ORDERS} className="ap-stat-card" style={{ '--stat-color': 'hsl(198, 85%, 48%)', '--stat-bg': 'hsla(198, 85%, 48%, 0.1)', cursor: 'pointer', textDecoration: 'none' }}>
          <div className="ap-stat-card__top">
            <div className="ap-stat-card__icon" aria-hidden="true">
              <ShoppingBag size={20} />
            </div>
          </div>
          <p className="ap-stat-card__label">Total Orders</p>
          <p className="ap-stat-card__value">{Number(kpis.total_orders ?? 0).toLocaleString('en-IN')}</p>
        </Link>
      </div>

      {/* ── LEADERBOARDS SECTION ── */}
      <h2 className="ap-section-title" style={{ marginBottom: '20px', fontSize: '1.25rem', fontWeight: '600', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
        Performance Leaderboards
      </h2>

      <div className="dashboard__grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '16px' }}>
        {/* Top Selling Products */}
        <div className="ap-card" style={{ minHeight: 'unset' }}>
          <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '12px', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontWeight: '600', fontSize: '0.95rem', color: 'var(--color-text-heading)' }}>
              Top Selling Products (Last 90 Days)
            </p>
          </div>
          <div className="ap-table-wrap">
            {!leaderboards.topProducts || leaderboards.topProducts.length === 0 ? (
              <p style={{ padding: '20px 0', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                No product sales data.
              </p>
            ) : (
              <table className="ap-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Rank</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Units Sold</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboards.topProducts.map((prod, index) => (
                    <tr key={prod.product_id}>
                      <td style={{ fontWeight: '700', color: 'var(--color-brand-primary)' }}>#{index + 1}</td>
                      <td style={{ fontWeight: '500' }}>{prod.product_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{Number(prod.units_sold).toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-status-success)' }}>
                        {fmtCurrency(prod.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top Suppliers */}
        <div className="ap-card" style={{ minHeight: 'unset' }}>
          <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '12px', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontWeight: '600', fontSize: '0.95rem', color: 'var(--color-text-heading)' }}>
              Top Suppliers by Revenue
            </p>
          </div>
          <div className="ap-table-wrap">
            {!leaderboards.topSuppliers || leaderboards.topSuppliers.length === 0 ? (
              <p style={{ padding: '20px 0', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                No supplier sales data.
              </p>
            ) : (
              <table className="ap-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Rank</th>
                    <th>Supplier</th>
                    <th style={{ textAlign: 'right' }}>Revenue Generated</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboards.topSuppliers.map((sup, index) => (
                    <tr key={index}>
                      <td style={{ fontWeight: '700', color: 'var(--color-brand-primary)' }}>#{index + 1}</td>
                      <td style={{ fontWeight: '500' }}>{sup.supplier_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-status-success)' }}>
                        {fmtCurrency(sup.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
