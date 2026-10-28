import { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  DollarSign,
  Activity,
  ArrowRight,
  Info,
  Layers
} from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

import { getSupplierPayouts } from '../../../services/paymentService.js';

export default function SupplierAnalytics() {
  useDocumentTitle('Vendor Analytics — ShopCart');
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('performance'); // performance, payouts
  const [payoutsData, setPayoutsData] = useState(null);
  const [loadingPayouts, setLoadingPayouts] = useState(false);

  const fetchSupplierData = async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await adminService.getSupplierAnalytics();
      setData(stats);
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to fetch vendor analytics');
      setError(msg);
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayouts = async () => {
    setLoadingPayouts(true);
    try {
      const res = await getSupplierPayouts();
      setPayoutsData(res);
    } catch (err) {
      showToast('error', 'Failed to fetch payouts log.');
    } finally {
      setLoadingPayouts(false);
    }
  };

  useEffect(() => {
    fetchSupplierData();
  }, []);

  useEffect(() => {
    if (activeTab === 'payouts') {
      fetchPayouts();
    }
  }, [activeTab]);

  const fmtCurrency = (v) => {
    return `₹${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  if (loading) {
    return (
      <div className="ap-loading" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <Spinner size="lg" />
        <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Loading metrics…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ap-empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p className="ap-empty__title" style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-status-error)' }}>Could not load analytics</p>
        <p className="ap-empty__desc" style={{ fontSize: '14px', margin: '8px 0 16px' }}>{error || 'Failed to load vendor data.'}</p>
        <button className="ap-btn ap-btn--primary" onClick={fetchSupplierData} style={{ minHeight: '44px', padding: '0 24px' }}>
          Retry
        </button>
      </div>
    );
  }

  const { summary = {}, bestSellers = [], lowStock = [], outOfStock = [], conversionRates = [] } = data;

  return (
    <div className="supplier-analytics" style={{ paddingBottom: '40px' }}>
      {/* ── Header ── */}
      <header className="ap-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="ap-title">Vendor Business Analytics</h1>
          <p className="ap-subtitle">Hello, {user?.username || 'Partner'}. View your isolated store performance and margin breakdowns.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="supplier-tabs" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('performance')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'performance' ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
            borderBottom: activeTab === 'performance' ? '2px solid var(--color-brand-primary)' : 'none',
            paddingBottom: '8px',
            minHeight: '44px'
          }}
          type="button"
        >
          Business Performance
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'payouts' ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
            borderBottom: activeTab === 'payouts' ? '2px solid var(--color-brand-primary)' : 'none',
            paddingBottom: '8px',
            minHeight: '44px'
          }}
          type="button"
        >
          Payouts & Earnings
        </button>
      </div>

      {activeTab === 'performance' ? (
        <>
          {/* ── KPI Grid ── */}
          <div className="ap-stats-grid">
            <div className="ap-stat-card" style={{ '--stat-color': 'hsl(162, 73%, 46%)', '--stat-bg': 'hsla(162, 73%, 46%, 0.1)' }}>
              <p className="ap-stat-card__label">Sales Revenue</p>
              <p className="ap-stat-card__value">{fmtCurrency(summary.revenue)}</p>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Units Sold: {summary.units_sold} | AOV: {fmtCurrency(summary.aov)}
              </span>
            </div>

            <div className="ap-stat-card" style={{ '--stat-color': 'hsl(243, 75%, 65%)', '--stat-bg': 'hsla(243, 75%, 65%, 0.1)' }}>
              <p className="ap-stat-card__label">Cost of Goods Sold (COGS)</p>
              <p className="ap-stat-card__value">{fmtCurrency(summary.cogs)}</p>
            </div>

            <div className="ap-stat-card" style={{ '--stat-color': 'hsl(198, 85%, 48%)', '--stat-bg': 'hsla(198, 85%, 48%, 0.1)' }}>
              <p className="ap-stat-card__label">Gross Profit</p>
              <p className="ap-stat-card__value">{fmtCurrency(summary.gross_profit)}</p>
              <span style={{ fontSize: '12px', color: 'var(--color-brand-primary)', fontWeight: '600' }}>
                Margin: {summary.gross_margin_pct.toFixed(1)}%
              </span>
            </div>

            <div className="ap-stat-card" style={{ '--stat-color': 'hsl(38, 88%, 52%)', '--stat-bg': 'hsla(38, 88%, 52%, 0.1)' }}>
              <p className="ap-stat-card__label">Orders Fulfilled</p>
              <p className="ap-stat-card__value">{summary.orders}</p>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Cancelled: {summary.cancellation_rate.toFixed(1)}% | Returned: {summary.refund_rate.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* ── Inventory Alerts banner ── */}
          {(lowStock.length > 0 || outOfStock.length > 0) && (
            <div className="supplier-analytics__alerts-panel" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {outOfStock.map((prod, idx) => (
                <div key={`out-${idx}`} className="ap-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderLeft: '4px solid var(--color-status-error)', backgroundColor: 'var(--color-surface-raised)', fontSize: '13px' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--color-status-error)', flexShrink: 0 }} />
                  <span><strong>Out of Stock:</strong> Product "{prod.product_name}" ({prod.sku}) has 0 remaining in inventory. Please restock immediately.</span>
                </div>
              ))}
              {lowStock.map((prod, idx) => (
                <div key={`low-${idx}`} className="ap-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderLeft: '4px solid var(--color-status-warning)', backgroundColor: 'var(--color-surface-raised)', fontSize: '13px' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--color-status-warning)', flexShrink: 0 }} />
                  <span><strong>Low Stock Warning:</strong> Product "{prod.product_name}" ({prod.sku}) has only {prod.available_stock} units left.</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Data Details Grids ── */}
          <div className="supplier-analytics__grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '28px' }}>
            
            {/* Best Selling Products */}
            <div className="ap-card">
              <h3 className="supplier-card-title" style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} style={{ color: 'var(--color-status-success)' }} />
                <span>Top Performing Products</span>
              </h3>
              <div className="ap-table-wrap">
                {bestSellers.length === 0 ? (
                  <p style={{ padding: '20px 0', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>No sales recorded yet.</p>
                ) : (
                  <table className="ap-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th style={{ textAlign: 'right' }}>Units Sold</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bestSellers.map((prod, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: '500' }}>{prod.product_name}</td>
                          <td style={{ textAlign: 'right' }}>{prod.quantity}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-status-success)' }}>{fmtCurrency(prod.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Product Conversion Rates */}
            <div className="ap-card">
              <h3 className="supplier-card-title" style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} style={{ color: 'var(--color-brand-primary)' }} />
                <span>Product Conversion Rates</span>
              </h3>
              <div className="ap-table-wrap">
                {conversionRates.length === 0 ? (
                  <p style={{ padding: '20px 0', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>No views logged.</p>
                ) : (
                  <table className="ap-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th style={{ textAlign: 'right' }}>Views</th>
                        <th style={{ textAlign: 'right' }}>Purchases</th>
                        <th style={{ textAlign: 'right' }}>Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversionRates.map((prod) => (
                        <tr key={prod.product_id}>
                          <td style={{ fontWeight: '500' }}>{prod.product_name}</td>
                          <td style={{ textAlign: 'right' }}>{prod.views}</td>
                          <td style={{ textAlign: 'right' }}>{prod.sales}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-brand-primary)' }}>
                            {prod.conversion_rate.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="supplier-payouts-view">
          {loadingPayouts ? (
            <div className="text-center py-4" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '8px' }}>
              <Spinner size="md" />
              <span>Fetching ledger data…</span>
            </div>
          ) : !payoutsData ? (
            <p>No payout data retrieved.</p>
          ) : (
            <>
              {/* Payout metrics cards */}
              <div className="ap-stats-grid" style={{ marginBottom: '24px' }}>
                <div className="ap-stat-card" style={{ '--stat-color': 'hsl(162, 73%, 46%)', '--stat-bg': 'hsla(162, 73%, 46%, 0.1)' }}>
                  <p className="ap-stat-card__label">Successful Payouts</p>
                  <p className="ap-stat-card__value">{fmtCurrency(payoutsData.summary.successfulPayouts)}</p>
                </div>

                <div className="ap-stat-card" style={{ '--stat-color': 'hsl(243, 75%, 65%)', '--stat-bg': 'hsla(243, 75%, 65%, 0.1)' }}>
                  <p className="ap-stat-card__label">Pending / Scheduled</p>
                  <p className="ap-stat-card__value">{fmtCurrency(payoutsData.summary.pendingPayouts)}</p>
                </div>

                <div className="ap-stat-card" style={{ '--stat-color': 'hsl(0, 75%, 60%)', '--stat-bg': 'hsla(0, 75%, 60%, 0.1)' }}>
                  <p className="ap-stat-card__label">Refund Deductions</p>
                  <p className="ap-stat-card__value">{fmtCurrency(payoutsData.summary.refundImpact)}</p>
                </div>

                <div className="ap-stat-card" style={{ '--stat-color': 'hsl(198, 85%, 48%)', '--stat-bg': 'hsla(198, 85%, 48%, 0.1)' }}>
                  <p className="ap-stat-card__label">Net Earnings</p>
                  <p className="ap-stat-card__value">{fmtCurrency(payoutsData.summary.netRevenue)}</p>
                </div>
              </div>

              {/* Payouts list table */}
              <div className="ap-card" style={{ padding: '20px' }}>
                <h3 className="supplier-card-title" style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Payout Transactions Ledger</h3>
                <div className="ap-table-wrap">
                  {payoutsData.payouts.length === 0 ? (
                    <p style={{ padding: '20px 0', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>No payouts generated yet.</p>
                  ) : (
                    <table className="ap-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Payout ID</th>
                          <th>Order Ref</th>
                          <th>Net Payout</th>
                          <th>Commission Deducted</th>
                          <th>Status</th>
                          <th>Generated At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payoutsData.payouts.map(p => (
                          <tr key={p.payout_id}>
                            <td className="font-mono">PAYOUT-{p.payout_id}</td>
                            <td className="font-mono">{p.order_number}</td>
                            <td style={{ fontWeight: '700', color: 'var(--color-status-success)' }}>{fmtCurrency(p.amount)}</td>
                            <td style={{ color: 'var(--color-text-muted)' }}>{fmtCurrency(p.commission_deducted)}</td>
                            <td>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  backgroundColor:
                                    p.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' :
                                    p.status === 'failed' ? 'rgba(239, 68, 68, 0.15)' :
                                    'rgba(245, 158, 11, 0.15)',
                                  color:
                                    p.status === 'completed' ? '#10b981' :
                                    p.status === 'failed' ? '#ef4444' :
                                    '#f59e0b'
                                }}
                              >
                                {p.status.toUpperCase()}
                              </span>
                            </td>
                            <td>{new Date(p.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
