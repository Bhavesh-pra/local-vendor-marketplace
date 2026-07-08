import { Search, ShieldAlert, ShieldCheck, Eye, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import { getCustomerType } from '../../../utils/customerHelper.js';
import './index.css';

export default function Customers() {
  useDocumentTitle('Customers — ShopCart Admin');
  const { showToast } = useToast();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllCustomers();
      setCustomers(data);
      setError(null);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch customers list');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleToggleBlock = async (id, currentStatus) => {
    // Note: status in DB is active or inactive (which means blocked)
    const targetStatus = currentStatus === 'inactive' ? 'active' : 'blocked';
    const actionLabel = targetStatus === 'blocked' ? 'block' : 'unblock';
    
    try {
      await adminService.setCustomerStatus(id, targetStatus);
      showToast('success', `Customer successfully ${actionLabel}ed`);
      // Update state locally
      setCustomers((prev) =>
        prev.map((c) =>
          c.user_id === id
            ? { ...c, status: targetStatus === 'blocked' ? 'inactive' : 'active' }
            : c
        )
      );
    } catch (err) {
      const errMsg = extractErrorMessage(err, `Failed to ${actionLabel} customer`);
      showToast('error', errMsg);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      c.username.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && c.status === 'active') ||
      (statusFilter === 'inactive' && c.status === 'inactive');

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '—') return <span className="missing-data-text">Not Provided</span>;
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="customers-page">
      <header className="ap-header">
        <div>
          <h1 className="ap-title">Customers</h1>
          <p className="ap-subtitle">Manage customer accounts, status, security and shopping history</p>
        </div>
      </header>

      {error && (
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button className="ap-btn ap-btn--primary" onClick={fetchCustomers} style={{ marginTop: '12px' }}>
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
          <div className="customers-page__toolbar">
            <div className="customers-page__search-wrap">
              <Search className="customers-page__search-icon" size={18} />
              <input
                type="text"
                placeholder="Search by name or email..."
                className="ap-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="customers-page__filters">
              <select
                className="ap-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Blocked</option>
              </select>
              <span className="customers-page__count">
                Showing {filteredCustomers.length} of {customers.length} customers
              </span>
            </div>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="ap-empty" style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Users size={40} style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }} />
              <p className="ap-empty__title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-heading)' }}>No customers yet.</p>
              <p className="ap-empty__desc" style={{ color: 'var(--color-text-muted)' }}>No customer accounts have registered on the platform.</p>
            </div>
          ) : (
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Segment</th>
                    <th>Phone</th>
                    <th style={{ textAlign: 'center' }}>Orders</th>
                    <th>Total Spending</th>
                    <th>Last Order</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => {
                    const isBlocked = c.status === 'inactive';
                    const customerType = getCustomerType(c.order_count, c.total_spending);
                    return (
                      <tr key={c.user_id}>
                        <td>
                          <div>
                            <div className="customers-page__name">{c.username}</div>
                            <div className="customers-page__email">{c.email}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`ap-badge ${customerType.badgeClass}`}>
                            {customerType.label}
                          </span>
                        </td>
                        <td>{c.phone ? c.phone : <span className="missing-data-text">Not Provided</span>}</td>
                        <td style={{ textAlign: 'center', fontWeight: '500' }}>{c.order_count}</td>
                        <td style={{ fontWeight: '600' }}>₹{Number(c.total_spending).toLocaleString('en-IN')}</td>
                        <td>{formatDate(c.last_order_date)}</td>
                        <td>
                          <span
                            className={`ap-badge ${
                              isBlocked ? 'ap-badge--red' : 'ap-badge--green'
                            }`}
                          >
                            {isBlocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>
                        <td>
                          <div className="ap-actions" style={{ justifyContent: 'flex-end' }}>
                            <Link to={`/admin/customers/${c.user_id}`} className="ap-btn ap-btn--ghost" title="View Customer Profile">
                              <Eye size={14} />
                              <span>Profile</span>
                            </Link>
                            <button
                              className={`ap-btn ${isBlocked ? 'ap-btn--success' : 'ap-btn--danger'}`}
                              onClick={() => handleToggleBlock(c.user_id, c.status)}
                              title={isBlocked ? 'Unblock Customer' : 'Block Customer'}
                            >
                              {isBlocked ? (
                                <>
                                  <ShieldCheck size={14} />
                                  <span>Unblock</span>
                                </>
                              ) : (
                                <>
                                  <ShieldAlert size={14} />
                                  <span>Block</span>
                                </>
                              )}
                            </button>
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
