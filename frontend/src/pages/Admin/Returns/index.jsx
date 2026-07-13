import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, MessageSquare } from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'active', label: 'Active Returns' },
  { id: 'completed', label: 'Completed' }
];

export default function Returns() {
  useDocumentTitle('Returns Management — ShopCart Admin');
  const { showToast } = useToast();

  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  // Modal/Inline state for recording transition notes
  // { return_id, status, notes }
  const [updatingReturn, setUpdatingReturn] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllReturns();
      setReturnsList(data);
      setError(null);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch returns');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!updatingReturn) return;

    setActionLoading(true);
    try {
      await adminService.updateReturnStatus(
        updatingReturn.return_id,
        updatingReturn.status,
        updatingReturn.notes.trim()
      );
      showToast('success', `Return status updated to ${updatingReturn.status.replace('_', ' ')}`);
      setUpdatingReturn(null);
      await fetchReturns();
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to update return status');
      showToast('error', errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredReturns = returnsList.filter((r) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return r.status === 'REQUESTED';
    if (activeTab === 'approved') return r.status === 'APPROVED';
    if (activeTab === 'rejected') return r.status === 'REJECTED';
    if (activeTab === 'active') {
      return ['APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REFUNDED', 'REPLACEMENT_SHIPPED'].includes(r.status);
    }
    if (activeTab === 'completed') {
      return ['REFUND_COMPLETED', 'REPLACEMENT_COMPLETED'].includes(r.status);
    }
    return true;
  });

  const getActionLabel = (action) => {
    switch (action) {
      case 'APPROVED': return 'Approve';
      case 'REJECTED': return 'Reject';
      case 'PICKUP_SCHEDULED': return 'Schedule Pickup';
      case 'PICKED_UP': return 'Mark Picked Up';
      case 'RECEIVED': return 'Mark Received';
      case 'REFUNDED': return 'Trigger Refund';
      case 'REPLACEMENT_SHIPPED': return 'Ship Replacement';
      case 'REFUND_COMPLETED':
      case 'REPLACEMENT_COMPLETED': return 'Mark Completed';
      default: return action;
    }
  };

  const getReasonLabel = (reason) => {
    return reason.replace(/_/g, ' ');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="admin-returns-page">
      <header className="ap-header">
        <div>
          <h1 className="ap-title">Returns & Replacements</h1>
          <p className="ap-subtitle">Manage customer return workflows, process refunds, and ship replacement items</p>
        </div>
      </header>

      {error && (
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button className="ap-btn ap-btn--primary" onClick={fetchReturns} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="ap-loading">
          <Spinner size="lg" />
        </div>
      ) : !error && (
        <div className="ap-card">
          {/* Navigation Tabs */}
          <div className="returns-page__tabs" role="tablist">
            {STATUS_TABS.map((tab) => {
              const count = tab.id === 'all'
                ? returnsList.length
                : tab.id === 'pending'
                  ? returnsList.filter(r => r.status === 'REQUESTED').length
                  : tab.id === 'approved'
                    ? returnsList.filter(r => r.status === 'APPROVED').length
                    : tab.id === 'rejected'
                      ? returnsList.filter(r => r.status === 'REJECTED').length
                      : tab.id === 'active'
                        ? returnsList.filter(r => ['APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REFUNDED', 'REPLACEMENT_SHIPPED'].includes(r.status)).length
                        : returnsList.filter(r => ['REFUND_COMPLETED', 'REPLACEMENT_COMPLETED'].includes(r.status)).length;

              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`returns-page__tab ${activeTab === tab.id ? 'returns-page__tab--active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setUpdatingReturn(null);
                  }}
                >
                  <span>{tab.label}</span>
                  <span className="returns-page__tab-badge">{count}</span>
                </button>
              );
            })}
          </div>

          {filteredReturns.length === 0 ? (
            <div className="ap-empty">
              <p>No return or replacement requests found in this category.</p>
            </div>
          ) : (
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Return ID</th>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Requested At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.map((r) => {
                    let typeClass = 'ap-badge--blue';
                    if (r.request_type === 'return') typeClass = 'ap-badge--yellow';

                    let statusClass = 'ap-badge--gray';
                    if (r.status === 'REQUESTED') statusClass = 'ap-badge--yellow';
                    else if (['APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED'].includes(r.status)) statusClass = 'ap-badge--blue';
                    else if (['REFUNDED', 'REPLACEMENT_SHIPPED'].includes(r.status)) statusClass = 'ap-badge--purple';
                    else if (['REFUND_COMPLETED', 'REPLACEMENT_COMPLETED'].includes(r.status)) statusClass = 'ap-badge--green';
                    else if (r.status === 'REJECTED') statusClass = 'ap-badge--red';

                    return (
                      <tr key={r.return_id}>
                        <td>#{r.return_id}</td>
                        <td>
                          <strong>{r.order_number}</strong>
                        </td>
                        <td>{r.username}</td>
                        <td>
                          <div className="returns-page__product-cell">
                            <span className="returns-page__product-name" title={r.product_name}>
                              {r.product_name}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`ap-badge ${typeClass}`} style={{ textTransform: 'capitalize' }}>
                            {r.request_type}
                          </span>
                        </td>
                        <td>
                          <div className="returns-page__reason-cell">
                            <span className="returns-page__reason-code">
                              {getReasonLabel(r.reason_code)}
                            </span>
                            {r.reason_description && (
                              <span className="returns-page__reason-desc" title={r.reason_description}>
                                {r.reason_description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`ap-badge ${statusClass}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>{formatDate(r.requested_at || r.created_at)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="returns-page__actions-cell">
                            {r.allowed_actions?.map((action) => (
                              <button
                                key={action}
                                className={`ap-btn ap-btn--sm ${
                                  action === 'REJECTED'
                                    ? 'ap-btn--danger'
                                    : ['REFUND_COMPLETED', 'REPLACEMENT_COMPLETED'].includes(action)
                                      ? 'ap-btn--success'
                                      : 'ap-btn--primary'
                                }`}
                                onClick={() => setUpdatingReturn({
                                  return_id: r.return_id,
                                  status: action,
                                  notes: ''
                                })}
                              >
                                {getActionLabel(action)}
                              </button>
                            ))}
                            {(!r.allowed_actions || r.allowed_actions.length === 0) && (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                                No Actions
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transition Update Notes Modal */}
      {updatingReturn && (
        <div className="returns-notes-modal-overlay" role="dialog" aria-modal="true">
          <div className="returns-notes-modal">
            <header className="returns-notes-modal__header">
              <h3>Advance Status to {updatingReturn.status.replace('_', ' ')}</h3>
            </header>
            <form onSubmit={handleStatusUpdate} className="returns-notes-modal__form">
              <div className="returns-notes-modal__field">
                <label htmlFor="transition-notes">Admin Notes / Reason *</label>
                <textarea
                  id="transition-notes"
                  placeholder="Enter logs or update notes for this transition..."
                  rows={4}
                  value={updatingReturn.notes}
                  onChange={(e) => setUpdatingReturn({ ...updatingReturn, notes: e.target.value })}
                  required
                />
              </div>
              <footer className="returns-notes-modal__footer">
                <button
                  type="button"
                  className="ap-btn ap-btn--secondary"
                  onClick={() => setUpdatingReturn(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ap-btn ap-btn--primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? <Spinner size="sm" /> : 'Confirm Status Change'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
