import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, AlertCircle } from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

export default function Requests() {
  useDocumentTitle('Requests — ShopCart Admin');
  const { showToast } = useToast();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // all | pending | approved | rejected

  // To track which request is currently being resolved inline
  // { id, actionType: 'approved' | 'rejected', adminNote: '' }
  const [resolvingRequest, setResolvingRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllRequests();
      setRequests(data);
      setError(null);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch requests');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleResolveSubmit = async (e, id) => {
    e.preventDefault();
    if (!resolvingRequest) return;
    try {
      setActionLoading(true);
      await adminService.handleRequest(
        id,
        resolvingRequest.actionType,
        resolvingRequest.adminNote.trim()
      );
      showToast('success', `Request successfully ${resolvingRequest.actionType}`);
      setResolvingRequest(null);
      // refetch list
      await fetchRequests();
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to update request');
      showToast('error', errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="requests-page">
      <header className="ap-header">
        <div>
          <h1 className="ap-title">Requests</h1>
          <p className="ap-subtitle">Manage customer cancellations, returns, and replacements</p>
        </div>
      </header>

      {error && (
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button className="ap-btn ap-btn--primary" onClick={fetchRequests} style={{ marginTop: '12px' }}>
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
          <div className="requests-page__tabs" role="tablist">
            {['all', 'pending', 'approved', 'rejected'].map((tab) => {
              const count = tab === 'all'
                ? requests.length
                : requests.filter((r) => r.status === tab).length;

              return (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  className={`requests-page__tab ${activeTab === tab ? 'requests-page__tab--active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab);
                    setResolvingRequest(null);
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{tab}</span>
                  <span className="requests-page__tab-badge">{count}</span>
                </button>
              );
            })}
          </div>

          {filteredRequests.length === 0 ? (
            <div className="ap-empty">
              <p>No requests found in this category.</p>
            </div>
          ) : (
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Request Type</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((r) => {
                    let typeClass = 'ap-badge--blue';
                    if (r.request_type === 'cancel') typeClass = 'ap-badge--red';
                    if (r.request_type === 'return') typeClass = 'ap-badge--yellow';

                    let statusClass = 'ap-badge--yellow';
                    if (r.status === 'approved') statusClass = 'ap-badge--green';
                    if (r.status === 'rejected') statusClass = 'ap-badge--red';

                    const isResolvingThis = resolvingRequest && resolvingRequest.id === r.request_id;

                    return (
                      <tr key={r.request_id}>
                        <td style={{ fontWeight: '600' }}>
                          <Link to={`/admin/orders/${r.order_id}`} className="requests-page__order-link">
                            #{r.order_number}
                          </Link>
                        </td>
                        <td>
                          <div>
                            <div>{r.username}</div>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{r.email}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`ap-badge ${typeClass}`} style={{ textTransform: 'capitalize' }}>
                            {r.request_type}
                          </span>
                        </td>
                        <td>
                          <div className="requests-page__reason" title={r.reason}>
                            {r.reason || <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>No reason provided</span>}
                          </div>
                          {r.admin_note && (
                            <div className="requests-page__admin-note">
                              <strong>Note:</strong> {r.admin_note}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`ap-badge ${statusClass}`} style={{ textTransform: 'capitalize' }}>
                            {r.status}
                          </span>
                        </td>
                        <td>{formatDate(r.created_at)}</td>
                        <td>
                          <div className="ap-actions" style={{ justifyContent: 'flex-end' }}>
                            {r.status === 'pending' && !isResolvingThis && (
                              <>
                                <button
                                  className="ap-btn ap-btn--success"
                                  onClick={() =>
                                    setResolvingRequest({
                                      id: r.request_id,
                                      actionType: 'approved',
                                      adminNote: '',
                                    })
                                  }
                                  title="Approve Request"
                                >
                                  <Check size={14} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  className="ap-btn ap-btn--danger"
                                  onClick={() =>
                                    setResolvingRequest({
                                      id: r.request_id,
                                      actionType: 'rejected',
                                      adminNote: '',
                                    })
                                  }
                                  title="Reject Request"
                                >
                                  <X size={14} />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {isResolvingThis && (
                              <form
                                className="requests-page__action-form"
                                onSubmit={(e) => handleResolveSubmit(e, r.request_id)}
                              >
                                <input
                                  type="text"
                                  placeholder="Admin feedback/note (optional)..."
                                  className="ap-input requests-page__note-input"
                                  value={resolvingRequest.adminNote}
                                  disabled={actionLoading}
                                  onChange={(e) =>
                                    setResolvingRequest((prev) => ({
                                      ...prev,
                                      adminNote: e.target.value,
                                    }))
                                  }
                                />
                                <button
                                  type="submit"
                                  className={`ap-btn ${
                                    resolvingRequest.actionType === 'approved'
                                      ? 'ap-btn--success'
                                      : 'ap-btn--danger'
                                  }`}
                                  disabled={actionLoading}
                                >
                                  {actionLoading ? <Spinner size="sm" /> : <span>Confirm</span>}
                                </button>
                                <button
                                  type="button"
                                  className="ap-btn ap-btn--ghost"
                                  disabled={actionLoading}
                                  onClick={() => setResolvingRequest(null)}
                                >
                                  Cancel
                                </button>
                              </form>
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
    </div>
  );
}
