import { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Package,
  Activity,
  Filter,
  RefreshCw,
  Clock,
  DollarSign,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

const COLORS = ['var(--color-brand-primary, #6366f1)', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function Analytics() {
  useDocumentTitle('Business Intelligence & Insights — ShopCart Admin');
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('sales');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Fetch data specific to the selected tab
  const fetchTabData = async (tab) => {
    setLoading(true);
    setError(null);
    try {
      let resData = null;
      if (tab === 'sales') {
        resData = await adminService.getSalesAnalytics();
      } else if (tab === 'orders') {
        resData = await adminService.getOrderAnalytics();
      } else if (tab === 'customers') {
        resData = await adminService.getCustomerAnalytics();
      } else if (tab === 'products') {
        resData = await adminService.getProductAnalytics();
      } else if (tab === 'funnel') {
        resData = await adminService.getFunnelAnalytics();
      } else if (tab === 'operational') {
        resData = await adminService.getOperationalMetrics();
      } else if (tab === 'inventory') {
        const [forecast, ops] = await Promise.all([
          adminService.getInventoryForecast(),
          adminService.getOperationsMetrics()
        ]);
        resData = { forecast, ops };
      }
      setData(resData);
    } catch (err) {
      const msg = extractErrorMessage(err, `Failed to load ${tab} analytics`);
      setError(msg);
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  const fmtCurrency = (v) => {
    return `₹${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  // ─── RENDERS ─────────────────────────────────────────────────────────────

  const renderSalesTab = () => {
    if (!data) return null;
    const { dailySales = [], categories = [], products = [], suppliers = [], summary = {} } = data;

    return (
      <div className="analytics-tab-content">
        <div className="ap-stats-grid">
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(162, 73%, 46%)', '--stat-bg': 'hsla(162, 73%, 46%, 0.1)' }}>
            <p className="ap-stat-card__label">Total Revenue</p>
            <p className="ap-stat-card__value">{fmtCurrency(summary.total_revenue)}</p>
            <span style={{ fontSize: '12px', color: summary.month_growth_pct >= 0 ? 'var(--color-status-success)' : 'var(--color-status-error)' }}>
              {summary.month_growth_pct >= 0 ? '▲' : '▼'} {Math.abs(summary.month_growth_pct || 0).toFixed(1)}% vs last month
            </span>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(243, 75%, 65%)', '--stat-bg': 'hsla(243, 75%, 65%, 0.1)' }}>
            <p className="ap-stat-card__label">Cost of Goods Sold (COGS)</p>
            <p className="ap-stat-card__value">{fmtCurrency(summary.total_cogs)}</p>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(198, 85%, 48%)', '--stat-bg': 'hsla(198, 85%, 48%, 0.1)' }}>
            <p className="ap-stat-card__label">Gross Profit</p>
            <p className="ap-stat-card__value">{fmtCurrency(summary.gross_profit)}</p>
            <span style={{ fontSize: '12px', color: 'var(--color-brand-primary)' }}>
              Gross Margin: {Number(summary.gross_margin_pct || 0).toFixed(1)}%
            </span>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(38, 88%, 52%)', '--stat-bg': 'hsla(38, 88%, 52%, 0.1)' }}>
            <p className="ap-stat-card__label">Average Order Value (AOV)</p>
            <p className="ap-stat-card__value">{fmtCurrency(summary.aov)}</p>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Revenue per Customer: {fmtCurrency(summary.revenue_per_customer)}
            </span>
          </div>
        </div>

        {/* Revenue Trend Chart */}
        <div className="ap-card" style={{ marginTop: '24px' }}>
          <h3 className="analytics-card-title">Revenue & Order Trends</h3>
          <div className="analytics-chart-wrap" style={{ height: '320px', marginTop: '16px' }}>
            {dailySales.length === 0 ? (
              <p className="ap-empty__desc">No sales history found.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySales} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle, #2a2e35)" />
                  <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={11} tickFormatter={(d) => d.split('-').slice(1).join('/')} />
                  <YAxis yAxisId="left" stroke="var(--color-text-muted)" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--color-text-muted)" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-heading)' }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="hsl(162, 73%, 46%)" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="hsl(243, 75%, 65%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Share & Leaderboard */}
        <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '24px' }}>
          <div className="ap-card">
            <h3 className="analytics-card-title">Revenue by Category</h3>
            <div className="analytics-chart-wrap" style={{ height: '260px', marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
              {categories.length === 0 ? (
                <p className="ap-empty__desc">No category breakdown available.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categories} dataKey="revenue" nameKey="category_name" cx="50%" cy="50%" outerRadius={80} label={(entry) => entry.category_name}>
                      {categories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => fmtCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="ap-card">
            <h3 className="analytics-card-title">Supplier Gross Profitability</h3>
            <div className="ap-table-wrap" style={{ marginTop: '16px' }}>
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Profit</th>
                    <th style={{ textAlign: 'right' }}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((sup, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '500' }}>{sup.supplier_name}</td>
                      <td style={{ textAlign: 'right' }}>{fmtCurrency(sup.revenue)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-status-success)' }}>{fmtCurrency(sup.gross_profit)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{sup.gross_margin_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOrdersTab = () => {
    if (!data) return null;
    const { statusCounts = {}, summary = {}, orderTrends = [] } = data;

    return (
      <div className="analytics-tab-content">
        <div className="ap-stats-grid">
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(198, 85%, 48%)', '--stat-bg': 'hsla(198, 85%, 48%, 0.1)' }}>
            <p className="ap-stat-card__label">Success (Delivered) Rate</p>
            <p className="ap-stat-card__value">{summary.success_rate.toFixed(1)}%</p>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(0, 80%, 62%)', '--stat-bg': 'hsla(0, 80%, 62%, 0.1)' }}>
            <p className="ap-stat-card__label">Cancellation Rate</p>
            <p className="ap-stat-card__value">{summary.cancellation_rate.toFixed(1)}%</p>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(38, 88%, 52%)', '--stat-bg': 'hsla(38, 88%, 52%, 0.1)' }}>
            <p className="ap-stat-card__label">Refund / Return Rate</p>
            <p className="ap-stat-card__value">{summary.refund_rate.toFixed(1)}%</p>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(243, 75%, 65%)', '--stat-bg': 'hsla(243, 75%, 65%, 0.1)' }}>
            <p className="ap-stat-card__label">Avg. Processing Duration</p>
            <p className="ap-stat-card__value">{(summary.avg_processing_hours || 0).toFixed(1)} hrs</p>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Avg. Delivery: {summary.avg_delivery_days.toFixed(1)} days
            </span>
          </div>
        </div>

        {/* Order Status Breakdown */}
        <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '24px' }}>
          <div className="ap-card">
            <h3 className="analytics-card-title">Orders by Status</h3>
            <div className="ap-table-wrap" style={{ marginTop: '16px' }}>
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <tr key={status}>
                      <td style={{ textTransform: 'capitalize', fontWeight: '500' }}>{status}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ap-card">
            <h3 className="analytics-card-title">Order Volume Trends</h3>
            <div className="analytics-chart-wrap" style={{ height: '220px', marginTop: '16px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                  <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={10} tickFormatter={(d) => d.split('-').slice(1).join('/')} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }} />
                  <Legend />
                  <Bar dataKey="total_orders" name="Placed" fill="var(--color-brand-primary)" />
                  <Bar dataKey="completed_orders" name="Delivered" fill="hsl(162, 73%, 46%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCustomersTab = () => {
    if (!data) return null;
    const { summary = {}, segments = {}, topSpenders = [] } = data;

    return (
      <div className="analytics-tab-content">
        <div className="ap-stats-grid">
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(243, 75%, 65%)', '--stat-bg': 'hsla(243, 75%, 65%, 0.1)' }}>
            <p className="ap-stat-card__label">Total Registered Customers</p>
            <p className="ap-stat-card__value">{summary.total_customers}</p>
            <span style={{ fontSize: '12px', color: 'var(--color-status-success)' }}>
              +{summary.new_customers} in last 30 days
            </span>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(162, 73%, 46%)', '--stat-bg': 'hsla(162, 73%, 46%, 0.1)' }}>
            <p className="ap-stat-card__label">Customer Lifetime Value (CLV)</p>
            <p className="ap-stat-card__value">{fmtCurrency(summary.clv)}</p>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(198, 85%, 48%)', '--stat-bg': 'hsla(198, 85%, 48%, 0.1)' }}>
            <p className="ap-stat-card__label">Repeat Purchase Rate</p>
            <p className="ap-stat-card__value">{summary.repeat_purchase_rate.toFixed(1)}%</p>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Purchase Freq: {summary.purchase_frequency.toFixed(2)} orders/user
            </span>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(38, 88%, 52%)', '--stat-bg': 'hsla(38, 88%, 52%, 0.1)' }}>
            <p className="ap-stat-card__label">Purchase Retention Rate</p>
            <p className="ap-stat-card__value">{summary.retention_30.toFixed(1)}%</p>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              60d: {summary.retention_60.toFixed(1)}% | 90d: {summary.retention_90.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '24px' }}>
          {/* Spend Segmentation */}
          <div className="ap-card">
            <h3 className="analytics-card-title">Customer Segmentation</h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              High-value users represent the top 10% of customers by lifetime spend.
            </p>
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th style={{ textAlign: 'right' }}>Customers Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: '600', color: 'var(--color-brand-primary)' }}>High Value (Top 10% spenders)</td>
                    <td style={{ textAlign: 'right', fontWeight: '700' }}>{segments.high_value}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: '500' }}>Repeat Buyers (&gt; 1 Order)</td>
                    <td style={{ textAlign: 'right' }}>{segments.repeat}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: '500' }}>One-time Buyers (1 Order)</td>
                    <td style={{ textAlign: 'right' }}>{segments.one_time}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Customers Spend Leaderboard */}
          <div className="ap-card">
            <h3 className="analytics-card-title">Top 10 spenders</h3>
            <div className="ap-table-wrap" style={{ marginTop: '16px' }}>
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th style={{ textAlign: 'right' }}>Orders</th>
                    <th style={{ textAlign: 'right' }}>Total Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {topSpenders.map((cust, idx) => (
                    <tr key={cust.user_id}>
                      <td style={{ fontWeight: '500' }}>
                        <div>{cust.username}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{cust.email}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{cust.order_count}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-status-success)' }}>
                        {fmtCurrency(cust.total_spend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProductsTab = () => {
    if (!data) return null;
    const { products = [] } = data;

    return (
      <div className="analytics-tab-content">
        <div className="ap-card">
          <h3 className="analytics-card-title">Product Catalog Performance</h3>
          <div className="ap-table-wrap" style={{ marginTop: '16px' }}>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                  <th style={{ textAlign: 'right' }}>Units</th>
                  <th style={{ textAlign: 'right' }}>Views</th>
                  <th style={{ textAlign: 'right' }}>Conv %</th>
                  <th style={{ textAlign: 'right' }}>Margin %</th>
                  <th style={{ textAlign: 'right' }}>Cart Abandon %</th>
                  <th style={{ textAlign: 'right' }}>Wishlist Conv</th>
                </tr>
              </thead>
              <tbody>
                {products.map((prod) => (
                  <tr key={prod.product_id}>
                    <td style={{ fontWeight: '500' }}>{prod.product_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmtCurrency(prod.revenue)}</td>
                    <td style={{ textAlign: 'right' }}>{prod.units_sold}</td>
                    <td style={{ textAlign: 'right' }}>{prod.view_count}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--color-brand-primary)' }}>
                      {prod.conversion_rate.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{prod.margin.toFixed(1)}%</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-status-error)' }}>
                      {prod.cart_abandonment_rate.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{prod.wishlist_conversion_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderFunnelTab = () => {
    if (!data) return null;
    const { funnel = [] } = data;

    return (
      <div className="analytics-tab-content">
        <div className="ap-card">
          <h3 className="analytics-card-title">Conversion Funnel (Last 90 Days)</h3>
          <div className="funnel-container" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {funnel.map((step, idx) => (
              <div key={idx} className="funnel-step-wrapper">
                <div
                  className="funnel-bar"
                  style={{
                    width: `${Math.max(15, step.overall_conversion_pct)}%`,
                    backgroundColor: `hsla(243, 75%, 65%, ${1 - idx * 0.1})`,
                    padding: '12px 16px',
                    borderRadius: '6px',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minWidth: '220px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <span style={{ fontWeight: '600', fontSize: '13px' }}>
                    {idx + 1}. {step.step}
                  </span>
                  <span style={{ fontWeight: '700', fontSize: '14px' }}>
                    {step.sessions} sessions ({step.overall_conversion_pct.toFixed(1)}%)
                  </span>
                </div>
                {idx < funnel.length - 1 && (
                  <div className="funnel-connector" style={{ paddingLeft: '24px', margin: '6px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    <ArrowRight size={14} style={{ transform: 'rotate(90deg)', color: 'var(--color-status-warning)' }} />
                    <span>Conversion: {step.step_conversion_pct.toFixed(1)}% | Abandonment: {step.abandonment_pct.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderOperationalTab = () => {
    if (!data) return null;
    const { summary = {}, slowestEndpoints = [], failedPayments = [] } = data;

    return (
      <div className="analytics-tab-content">
        <div className="ap-stats-grid">
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(243, 75%, 65%)', '--stat-bg': 'hsla(243, 75%, 65%, 0.1)' }}>
            <p className="ap-stat-card__label">Average API Latency</p>
            <p className="ap-stat-card__value">{(summary.avg_response_time || 0).toFixed(1)} ms</p>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Logged: {summary.total_requests} endpoint calls
            </span>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': summary.error_rate > 1 ? 'var(--color-status-error)' : 'hsl(162, 73%, 46%)', '--stat-bg': summary.error_rate > 1 ? 'hsla(0, 80%, 62%, 0.1)' : 'hsla(162, 73%, 46%, 0.1)' }}>
            <p className="ap-stat-card__label">API Error Rate</p>
            <p className="ap-stat-card__value">{summary.error_rate.toFixed(2)}%</p>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(198, 85%, 48%)', '--stat-bg': 'hsla(198, 85%, 48%, 0.1)' }}>
            <p className="ap-stat-card__label">Search Usage Rate</p>
            <p className="ap-stat-card__value">{summary.search_usage_rate.toFixed(1)}%</p>
          </div>
          <div className="ap-stat-card" style={{ '--stat-color': 'hsl(38, 88%, 52%)', '--stat-bg': 'hsla(38, 88%, 52%, 0.1)' }}>
            <p className="ap-stat-card__label">Recommendations CTR</p>
            <p className="ap-stat-card__value">{summary.recommendation_ctr.toFixed(1)}%</p>
          </div>
        </div>

        <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '24px' }}>
          {/* Slowest Endpoints */}
          <div className="ap-card">
            <h3 className="analytics-card-title">Slowest Endpoints (Top 10)</h3>
            <div className="ap-table-wrap" style={{ marginTop: '16px' }}>
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Endpoint</th>
                    <th style={{ textAlign: 'right' }}>Hits</th>
                    <th style={{ textAlign: 'right' }}>Avg (ms)</th>
                    <th style={{ textAlign: 'right' }}>Max (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {slowestEndpoints.map((end, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                        <span style={{ color: 'var(--color-brand-primary)', fontWeight: 'bold', marginRight: '6px' }}>{end.method}</span>
                        {end.path}
                      </td>
                      <td style={{ textAlign: 'right' }}>{end.hits}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{end.avg_duration.toFixed(1)}</td>
                      <td style={{ textAlign: 'right' }}>{end.max_duration.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Failed Payments Audit Log */}
          <div className="ap-card">
            <h3 className="analytics-card-title">Payment Failures Log</h3>
            <div className="ap-table-wrap" style={{ marginTop: '16px' }}>
              {failedPayments.length === 0 ? (
                <p className="ap-empty__desc" style={{ padding: '20px 0', textAlign: 'center' }}>No recorded payment failures.</p>
              ) : (
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Method</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedPayments.map((p, idx) => (
                      <tr key={idx}>
                        <td style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {new Date(p.created_at).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ fontWeight: '500' }}>{p.payment_method}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmtCurrency(p.amount)}</td>
                        <td style={{ color: 'var(--color-status-error)', fontSize: '12px' }}>{p.reason}</td>
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
  };

  const renderInventoryTab = () => {
    if (!data) return null;
    const { forecast = [], ops = [] } = data;

    return (
      <div className="analytics-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Restock Forecast alerts */}
        <div className="ap-card">
          <h3 className="analytics-card-title">Restock Forecast (Risk categorization)</h3>
          <div className="ap-table-wrap" style={{ marginTop: '16px' }}>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th style={{ textAlign: 'right' }}>Current Stock</th>
                  <th style={{ textAlign: 'right' }}>Daily Avg Sales</th>
                  <th style={{ textAlign: 'right' }}>Days Remaining</th>
                  <th>Risk Category</th>
                </tr>
              </thead>
              <tbody>
                {forecast.slice(0, 10).map((row) => (
                  <tr key={row.variant_id}>
                    <td>
                      <span style={{ fontWeight: '500' }}>{row.product_name}</span>
                      {row.size || row.color ? <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '6px' }}>({[row.size, row.color].filter(Boolean).join('/')})</span> : null}
                    </td>
                    <td>{row.sku}</td>
                    <td style={{ textAlign: 'right' }}>{row.current_stock}</td>
                    <td style={{ textAlign: 'right' }}>{row.daily_average_sales_30d.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                      {row.days_of_inventory === 999999 ? '∞' : row.days_of_inventory.toFixed(1)}
                    </td>
                    <td>
                      <span className={`ap-badge ap-badge--${row.forecast_risk.toLowerCase()}`}>
                        {row.forecast_risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operational Turnover flags */}
        <div className="ap-card">
          <h3 className="analytics-card-title">Inventory Performance Flags</h3>
          <div className="ap-table-wrap" style={{ marginTop: '16px' }}>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th style={{ textAlign: 'right' }}>Turnover Rate</th>
                  <th style={{ textAlign: 'right' }}>Return Rate</th>
                  <th style={{ textAlign: 'right' }}>Sell-Through Rate</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {ops.slice(0, 10).map((row) => (
                  <tr key={row.variant_id}>
                    <td>
                      <span style={{ fontWeight: '500' }}>{row.product_name}</span>
                      {row.size || row.color ? <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '6px' }}>({[row.size, row.color].filter(Boolean).join('/')})</span> : null}
                    </td>
                    <td>{row.sku}</td>
                    <td style={{ textAlign: 'right' }}>{row.inventory_turnover.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: row.return_rate > 0.05 ? 'var(--color-status-error)' : 'inherit' }}>
                      {(row.return_rate * 100).toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                      {(row.sell_through_rate * 100).toFixed(1)}%
                    </td>
                    <td>
                      {row.flags.length === 0 ? (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Healthy</span>
                      ) : (
                        row.flags.map(f => (
                          <span key={f} className={`ap-badge ap-badge--${f.toLowerCase().replace(/_/g, '-')}`} style={{ marginRight: '4px' }}>
                            {f}
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-page">
      <header className="ap-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="ap-title">Analytics & Business Intelligence</h1>
          <p className="ap-subtitle">Real-time performance metrics, customer journey tracking, and system health insights.</p>
        </div>
      </header>

      {/* ── Tabs Navigation ── */}
      <div className="analytics-tabs-nav" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '1px', marginBottom: '24px', overflowX: 'auto' }}>
        {[
          { id: 'sales', label: 'Sales & Revenue', icon: TrendingUp },
          { id: 'orders', label: 'Orders & Fulfilment', icon: ShoppingBag },
          { id: 'customers', label: 'Customer Retention', icon: Users },
          { id: 'products', label: 'Product Performance', icon: Package },
          { id: 'funnel', label: 'Conversion Funnel', icon: Filter },
          { id: 'operational', label: 'Operational Metrics', icon: Activity },
          { id: 'inventory', label: 'Inventory Intelligence', icon: Clock }
        ].map(tab => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`analytics-tab-btn ${isSelected ? 'analytics-tab-btn--active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                fontSize: '14px',
                fontWeight: '500',
                color: isSelected ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                borderBottom: isSelected ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                minHeight: '44px' // Touch target rule compliance
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Active Tab Content ── */}
      {loading ? (
        <div style={{ padding: '80px 0', display: 'flex', justifyContent: 'center' }}>
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-status-error)' }}>
          <p style={{ color: 'var(--color-status-error)', fontWeight: '600' }}>{error}</p>
          <button className="ap-btn ap-btn--primary" onClick={() => fetchTabData(activeTab)} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      ) : (
        <>
          {activeTab === 'sales' && renderSalesTab()}
          {activeTab === 'orders' && renderOrdersTab()}
          {activeTab === 'customers' && renderCustomersTab()}
          {activeTab === 'products' && renderProductsTab()}
          {activeTab === 'funnel' && renderFunnelTab()}
          {activeTab === 'operational' && renderOperationalTab()}
          {activeTab === 'inventory' && renderInventoryTab()}
        </>
      )}
    </div>
  );
}
