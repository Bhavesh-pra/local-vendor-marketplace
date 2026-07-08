import { useState, useEffect } from 'react';
import { TrendingUp, Users, ShoppingBag, AlertCircle, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import { STATUS_MAP } from '../Orders/index.jsx';
import './index.css';

export default function Analytics() {
  useDocumentTitle('Analytics — ShopCart Admin');
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await adminService.getAnalytics();
      setData(res);
      setError(null);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch analytics data');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const formatDayDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const formatMonthDate = (monthStr) => {
    try {
      const [year, month] = monthStr.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    } catch {
      return monthStr;
    }
  };

  if (loading) {
    return (
      <div className="ap-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="analytics-page">
        <header className="ap-header">
          <div>
            <h1 className="ap-title">Analytics</h1>
            <p className="ap-subtitle">Insights, performance stats and business intelligence</p>
          </div>
        </header>
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)', marginTop: '20px' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error || 'Failed to load analytics'}</p>
          <button className="ap-btn ap-btn--primary" onClick={fetchAnalytics} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Pre-process chart data
  const processedRevenueByDay = (data.revenueByDay || []).map((item) => ({
    ...item,
    formattedDate: formatDayDate(item.date),
  }));

  const processedRevenueByMonth = (data.revenueByMonth || []).map((item) => ({
    ...item,
    formattedMonth: formatMonthDate(item.month),
  }));

  const processedOrdersByStatus = (data.ordersByStatus || []).map((item) => {
    const config = STATUS_MAP[item.status] || { label: item.status };
    return {
      name: config.label,
      count: item.count,
    };
  });

  const processedCategoryPerformance = (data.categoryPerformance || []).map((item) => ({
    ...item,
    revenue: parseFloat(item.revenue || 0),
  }));

  // Find request counts
  const reqStats = data.requestStats || [];
  const pendingRequests = reqStats.find(r => r.status === 'pending')?.count || 0;
  const approvedRequests = reqStats.find(r => r.status === 'approved')?.count || 0;
  const rejectedRequests = reqStats.find(r => r.status === 'rejected')?.count || 0;

  return (
    <div className="analytics-page">
      <header className="ap-header">
        <div>
          <h1 className="ap-title">Analytics Dashboard</h1>
          <p className="ap-subtitle">Real-time charts, category shares and store performance metrics</p>
        </div>
        <button className="ap-btn ap-btn--ghost" onClick={fetchAnalytics} title="Refresh Analytics">
          <RefreshCw size={15} />
          <span>Refresh</span>
        </button>
      </header>

      {/* Overview Stat Mini Cards */}
      <div className="ap-stats-grid">
        <div className="ap-stat-card" style={{ '--stat-color': 'hsl(162, 73%, 46%)', '--stat-bg': 'hsla(162,73%,46%,0.1)' }}>
          <div className="ap-stat-card__top">
            <span className="ap-stat-card__label">Active Customers</span>
            <div className="ap-stat-card__icon"><Users size={20} /></div>
          </div>
          <div className="ap-stat-card__value">{data.customers?.total ?? 0}</div>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            +{data.customers?.thisWeek ?? 0} joined this week
          </p>
        </div>

        <div className="ap-stat-card" style={{ '--stat-color': 'hsl(243, 75%, 65%)', '--stat-bg': 'hsla(243,75%,65%,0.1)' }}>
          <div className="ap-stat-card__top">
            <span className="ap-stat-card__label">Request Backlog</span>
            <div className="ap-stat-card__icon"><RefreshCw size={20} /></div>
          </div>
          <div className="ap-stat-card__value">{pendingRequests}</div>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Requires admin intervention
          </p>
        </div>

        <div className="ap-stat-card" style={{ '--stat-color': 'hsl(38, 88%, 52%)', '--stat-bg': 'hsla(38,88%,52%,0.1)' }}>
          <div className="ap-stat-card__top">
            <span className="ap-stat-card__label">Approved Requests</span>
            <div className="ap-stat-card__icon"><TrendingUp size={20} /></div>
          </div>
          <div className="ap-stat-card__value">{approvedRequests}</div>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Cancellations & returns resolved
          </p>
        </div>
      </div>

      <div className="analytics-page__grid">
        {/* Daily Revenue Line Chart */}
        <div className="ap-card analytics-page__chart-card">
          <h2 className="analytics-page__chart-title">Revenue Trend (Last 30 Days)</h2>
          <div className="analytics-page__chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={processedRevenueByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e35" />
                <XAxis dataKey="formattedDate" stroke="#8a929e" fontSize={11} tickLine={false} />
                <YAxis stroke="#8a929e" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1d24', borderColor: '#2a2e35', color: '#f3f4f6' }}
                  formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke="hsl(162, 73%, 46%)" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Revenue Bar Chart */}
        <div className="ap-card analytics-page__chart-card">
          <h2 className="analytics-page__chart-title">Monthly Revenue (Last 12 Months)</h2>
          <div className="analytics-page__chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processedRevenueByMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e35" />
                <XAxis dataKey="formattedMonth" stroke="#8a929e" fontSize={11} tickLine={false} />
                <YAxis stroke="#8a929e" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1d24', borderColor: '#2a2e35', color: '#f3f4f6' }}
                  formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="hsl(243, 75%, 59%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Performance Bar Chart */}
        <div className="ap-card analytics-page__chart-card">
          <h2 className="analytics-page__chart-title">Revenue by Category</h2>
          <div className="analytics-page__chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processedCategoryPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e35" />
                <XAxis dataKey="category_name" stroke="#8a929e" fontSize={11} tickLine={false} />
                <YAxis stroke="#8a929e" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1d24', borderColor: '#2a2e35', color: '#f3f4f6' }}
                  formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="hsl(38, 88%, 52%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders by Status Horizontal Bar Chart */}
        <div className="ap-card analytics-page__chart-card">
          <h2 className="analytics-page__chart-title">Orders by Status</h2>
          <div className="analytics-page__chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processedOrdersByStatus} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e35" horizontal={false} />
                <XAxis type="number" stroke="#8a929e" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke="#8a929e" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1d24', borderColor: '#2a2e35', color: '#f3f4f6' }} />
                <Bar dataKey="count" fill="hsl(270, 72%, 68%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="analytics-page__two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px', alignItems: 'start' }}>
        {/* Customer Growth Stats Card */}
        <div className="ap-card analytics-page__chart-card">
          <h2 className="analytics-page__chart-title">Customer Acquisition</h2>
          <div className="analytics-page__customer-stats">
            <div className="analytics-page__customer-stat">
              <span className="analytics-page__customer-number">{data.customers?.thisWeek ?? 0}</span>
              <span className="analytics-page__customer-label">New This Week</span>
            </div>
            <div className="analytics-page__customer-stat">
              <span className="analytics-page__customer-number">{data.customers?.thisMonth ?? 0}</span>
              <span className="analytics-page__customer-label">New This Month</span>
            </div>
            <div className="analytics-page__customer-stat">
              <span className="analytics-page__customer-number">{data.customers?.total ?? 0}</span>
              <span className="analytics-page__customer-label">Total Registered</span>
            </div>
          </div>
        </div>

        {/* Request Stats Overview Card */}
        <div className="ap-card analytics-page__chart-card">
          <h2 className="analytics-page__chart-title">Request Stats Summary</h2>
          <div className="analytics-page__request-stats">
            <div className="analytics-page__request-stat" style={{ borderLeft: '3px solid var(--color-warning)' }}>
              <span className="analytics-page__request-label">Pending Reviews</span>
              <span className="analytics-page__request-value">{pendingRequests}</span>
            </div>
            <div className="analytics-page__request-stat" style={{ borderLeft: '3px solid var(--color-success)' }}>
              <span className="analytics-page__request-label">Approved Requests</span>
              <span className="analytics-page__request-value">{approvedRequests}</span>
            </div>
            <div className="analytics-page__request-stat" style={{ borderLeft: '3px solid var(--color-danger)' }}>
              <span className="analytics-page__request-label">Rejected Requests</span>
              <span className="analytics-page__request-value">{rejectedRequests}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 Products Table Card */}
      <div className="ap-card" style={{ marginTop: '24px' }}>
        <h2 className="analytics-page__chart-title" style={{ marginBottom: '16px' }}>Top 5 Best-Selling Products</h2>
        {(!data.bestSelling || data.bestSelling.length === 0) ? (
          <div className="ap-empty">No order details found.</div>
        ) : (
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Rank</th>
                  <th>Product</th>
                  <th>Price</th>
                  <th style={{ textAlign: 'center' }}>Units Sold</th>
                  <th style={{ textAlign: 'center' }}>Order Count</th>
                  <th style={{ textAlign: 'right' }}>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.bestSelling.map((prod, index) => (
                  <tr key={prod.product_id}>
                    <td style={{ fontWeight: '700', color: 'var(--color-primary)' }}>#{index + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={prod.image_url || '/placeholder-product.svg'}
                          alt={prod.product_name}
                          className="analytics-page__prod-img"
                          onError={(e) => {
                            e.target.src = '/placeholder-product.svg';
                          }}
                        />
                        <span style={{ fontWeight: '500' }}>{prod.product_name}</span>
                      </div>
                    </td>
                    <td>₹{Number(prod.selling_price).toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'center', fontWeight: '600' }}>{prod.total_quantity}</td>
                    <td style={{ textAlign: 'center' }}>{prod.order_count}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-success)' }}>
                      ₹{Number(prod.total_revenue).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
