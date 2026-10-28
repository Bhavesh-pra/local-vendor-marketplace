import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../hooks/useToast.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { getFinanceMetrics, updatePlatformSettings, approveRefund, triggerSupplierPayout } from '../../../services/paymentService.js';
import { formatCurrency } from '../../../utils/formatters.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Percent, AlertOctagon, HelpCircle, Save, Check, X, CreditCard, RefreshCw } from 'lucide-react';
import './index.css';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899'];

export function FinanceDashboard() {
  const { showToast } = useToast();

  const [metrics, setMetrics] = useState(null);
  const [distribution, setDistribution] = useState([]);
  const [refundRequests, setRefundRequests] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Rejection state
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchFinanceData = useCallback(async () => {
    try {
      const data = await getFinanceMetrics();
      setMetrics(data.metrics);
      setDistribution(data.distribution || []);
      setRefundRequests(data.refundRequests || []);
      setPayouts(data.payouts || []);

      // Convert settings array to key-value map
      const config = {};
      (data.settings || []).forEach(s => {
        config[s.key] = s.value;
      });
      setSettings(config);
    } catch (err) {
      showToast('error', 'Failed to retrieve financial metrics.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  const handleUpdateSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      await updatePlatformSettings({
        commission_percentage: parseFloat(settings.commission_percentage),
        fixed_transaction_fee: parseFloat(settings.fixed_transaction_fee),
        minimum_commission: parseFloat(settings.minimum_commission),
        maximum_commission: parseFloat(settings.maximum_commission)
      });
      showToast('success', 'Commission settings updated successfully.');
      await fetchFinanceData();
    } catch (err) {
      showToast('error', 'Failed to save settings: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApproveRefund = async (refundId) => {
    try {
      const result = await approveRefund(refundId, 'approved');
      const dest = result.refund_destination;
      if (dest?.requires_manual_action) {
        showToast('info', `Refund approved. ⚠️ Manual ${dest.method} refund required — create disbursement record.`);
      } else {
        showToast('success', 'Refund approved and customer wallet credited automatically.');
      }
      await fetchFinanceData();
    } catch (err) {
      showToast('error', 'Refund approval failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRejectRefundSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!rejectionReason.trim()) {
      showToast('error', 'Please provide a reason for rejection.');
      return;
    }
    try {
      await approveRefund(rejectingId, 'rejected', rejectionReason.trim());
      showToast('info', 'Refund request rejected.');
      setRejectingId(null);
      setRejectionReason('');
      await fetchFinanceData();
    } catch (err) {
      showToast('error', 'Rejection failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleTriggerPayout = async (payoutId) => {
    try {
      await triggerSupplierPayout(payoutId);
      showToast('success', 'Payout processed and status set to completed.');
      await fetchFinanceData();
    } catch (err) {
      showToast('error', 'Payout trigger failed: ' + (err.response?.data?.message || err.message));
    }
  };

  if (loading) {
    return (
      <div className="finance-loading">
        <Spinner size="lg" />
        <p>Analyzing marketplace ledger...</p>
      </div>
    );
  }

  return (
    <div className="finance-dashboard-wrapper">
      <div className="finance-dashboard__header">
        <h2 className="dashboard-title">Financial Transaction Center</h2>
        <p className="dashboard-subtitle">Audited platform ledger, refunds settlement, and payouts releases</p>
      </div>

      {/* KPI Stats cards */}
      <div className="finance-kpi-grid">
        <div className="kpi-card glassmorphism">
          <div className="kpi-card__header">
            <DollarSign className="kpi-icon icon-blue" size={20} />
            <span className="kpi-title">Total Payment Volume (TPV)</span>
          </div>
          <span className="kpi-value">{formatCurrency(metrics?.tpv)}</span>
        </div>

        <div className="kpi-card glassmorphism">
          <div className="kpi-card__header">
            <Percent className="kpi-icon icon-green" size={20} />
            <span className="kpi-title">Payment Success Rate</span>
          </div>
          <span className="kpi-value">{metrics?.successRate?.toFixed(2)}%</span>
        </div>

        <div className="kpi-card glassmorphism">
          <div className="kpi-card__header">
            <AlertOctagon className="kpi-icon icon-orange" size={20} />
            <span className="kpi-title">Refunds Settled</span>
          </div>
          <span className="kpi-value">{formatCurrency(metrics?.refundsIssued)}</span>
          <span className="kpi-subtext">Refund Rate: {metrics?.refundRate?.toFixed(2)}%</span>
        </div>

        <div className="kpi-card glassmorphism">
          <div className="kpi-card__header">
            <HelpCircle className="kpi-icon icon-purple" size={20} />
            <span className="kpi-title">Platform Commissions Earned</span>
          </div>
          <span className="kpi-value">{formatCurrency(metrics?.platformCommissions)}</span>
        </div>
      </div>

      <div className="finance-main-grid">
        {/* Charts & Config split */}
        <div className="finance-side-column">
          {/* Commission settings form */}
          <div className="finance-card glassmorphism">
            <h3 className="card-title">Platform Commission Config</h3>
            <form onSubmit={handleUpdateSettings} className="settings-form">
              <div className="form-group">
                <label className="form-label" htmlFor="comm-pct-input">Commission Percentage (%):</label>
                <input
                  id="comm-pct-input"
                  type="number"
                  step="0.1"
                  className="settings-input"
                  value={settings.commission_percentage || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, commission_percentage: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="flat-fee-input">Fixed Transaction Fee (INR):</label>
                <input
                  id="flat-fee-input"
                  type="number"
                  className="settings-input"
                  value={settings.fixed_transaction_fee || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, fixed_transaction_fee: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="min-comm-input">Minimum Cap (INR):</label>
                <input
                  id="min-comm-input"
                  type="number"
                  className="settings-input"
                  value={settings.minimum_commission || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, minimum_commission: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="max-comm-input">Maximum Cap (INR):</label>
                <input
                  id="max-comm-input"
                  type="number"
                  className="settings-input"
                  value={settings.maximum_commission || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, maximum_commission: e.target.value }))}
                />
              </div>

              <button
                type="submit"
                className="settings-save-btn"
                disabled={savingSettings}
              >
                <Save size={18} />
                {savingSettings ? 'Saving...' : 'Update Policy Settings'}
              </button>
            </form>
          </div>

          {/* Payment Method Distribution */}
          <div className="finance-card glassmorphism">
            <h3 className="card-title">Payment Method Split</h3>
            <div className="chart-wrapper">
              {distribution.length === 0 ? (
                <div className="empty-chart">No payment methods recorded.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="total"
                      nameKey="payment_method"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      label={({ payment_method, percent }) => `${payment_method} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {distribution.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Action tables column */}
        <div className="finance-tables-column">
          {/* Refund Approvals Panel */}
          <div className="finance-card glassmorphism">
            <h3 className="card-title">Refund Verification Queue</h3>
            <div className="refund-queue-list">
              {refundRequests.filter(r => r.status === 'requested').length === 0 ? (
                <div className="empty-queue">
                  <p>All refund requests verified. No pending reviews.</p>
                </div>
              ) : (
                refundRequests.filter(r => r.status === 'requested').map(r => (
                  <div key={r.refund_id} className="queue-item">
                    <div className="queue-info">
                      <p className="queue-user">Customer: <strong>{r.customer_name}</strong></p>
                      <p className="queue-meta">Order: {r.order_number} | Ref: {r.transaction_reference}</p>
                      <p className="queue-reason">Reason: "{r.reason}"</p>
                      <p className="queue-amount">Settlement Amount: <span className="highlight-amt">{formatCurrency(r.amount)}</span></p>
                    </div>

                    {rejectingId === r.refund_id ? (
                      <form onSubmit={handleRejectRefundSubmit} className="rejection-form">
                        <input
                          type="text"
                          className="rejection-input"
                          placeholder="Rejection reason..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                        />
                        <div className="rejection-actions">
                          <button type="submit" className="action-btn-circle btn-red"><Check size={14} /></button>
                          <button type="button" className="action-btn-circle btn-grey" onClick={() => setRejectingId(null)}><X size={14} /></button>
                        </div>
                      </form>
                    ) : (
                      <div className="queue-actions">
                        <button
                          onClick={() => handleApproveRefund(r.refund_id)}
                          className="queue-btn approve-btn"
                          type="button"
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(r.refund_id)}
                          className="queue-btn reject-btn"
                          type="button"
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payout Releases Dashboard */}
          <div className="finance-card glassmorphism">
            <h3 className="card-title">Supplier Payout Settlement</h3>
            <div className="table-responsive">
              <table className="payout-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Order Ref</th>
                    <th>Payout Amount</th>
                    <th>Commission</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">No payout ledgers calculated.</td>
                    </tr>
                  ) : (
                    payouts.map(p => (
                      <tr key={p.payout_id}>
                        <td>{p.supplier_name}</td>
                        <td className="font-mono text-sm">{p.order_number}</td>
                        <td className="font-semibold text-green">{formatCurrency(p.amount)}</td>
                        <td className="text-muted">{formatCurrency(p.commission_deducted)}</td>
                        <td>
                          <span className={`payout-badge badge-${p.status}`}>
                            {p.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {p.status === 'scheduled' || p.status === 'processing' ? (
                            <button
                              onClick={() => handleTriggerPayout(p.payout_id)}
                              className="payout-action-btn"
                              type="button"
                            >
                              <CreditCard size={12} /> Release Funds
                            </button>
                          ) : p.status === 'pending' ? (
                            <span className="text-muted text-xs">Awaiting Delivery</span>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default FinanceDashboard;
