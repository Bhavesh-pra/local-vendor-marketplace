import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, Calendar, RefreshCw, ShoppingBag } from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

export const STATUS_MAP = {
  pending: { label: 'Pending', badgeClass: 'ap-badge--yellow' },
  processing: { label: 'Processing', badgeClass: 'ap-badge--blue' },
  shipped: { label: 'Shipped', badgeClass: 'ap-badge--purple' },
  delivered: { label: 'Delivered', badgeClass: 'ap-badge--green' },
  cancelled: { label: 'Cancelled', badgeClass: 'ap-badge--red' },
  returned: { label: 'Returned', badgeClass: 'ap-badge--orange' },
};

const TABS = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
];

export default function Orders() {
  useDocumentTitle('Orders Center — ShopCart Admin');
  const { showToast } = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter/Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all'); // all | paid | unpaid
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllOrders();
      setOrders(data);
      setError(null);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch orders');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter((o) => {
    // Customer name / email / username or Order # search
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      o.order_number.toLowerCase().includes(term) ||
      o.customer_name.toLowerCase().includes(term) ||
      o.customer_email.toLowerCase().includes(term) ||
      o.username.toLowerCase().includes(term);

    // Status Tab filter
    const matchesStatus = activeTab === 'all' || o.status === activeTab;

    // Payment Status filter
    let matchesPayment = true;
    if (paymentFilter === 'paid') {
      matchesPayment = o.payment_status === 'paid';
    } else if (paymentFilter === 'unpaid') {
      matchesPayment = o.payment_status === 'pending' || o.payment_status === 'failed';
    }

    // Date range filter
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(o.placed_at) >= new Date(startDate);
    }
    if (endDate) {
      const endLimit = new Date(endDate);
      endLimit.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(o.placed_at) <= endLimit;
    }

    return matchesSearch && matchesStatus && matchesPayment && matchesDate;
  });

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setPaymentFilter('all');
    setStartDate('');
    setEndDate('');
    setActiveTab('all');
  };

  return (
    <div className="orders-page">
      <header className="ap-header">
        <div>
          <h1 className="ap-title">Orders Center</h1>
          <p className="ap-subtitle">Manage customer transaction lifecycle and fulfillment workflows</p>
        </div>
        <button className="ap-btn ap-btn--ghost" onClick={fetchOrders} title="Refresh orders list">
          <RefreshCw size={15} style={{ marginRight: '6px' }} />
          <span>Refresh</span>
        </button>
      </header>

      {error && (
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button className="ap-btn ap-btn--primary" onClick={fetchOrders} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="ap-loading">
          <Spinner size="lg" />
        </div>
      ) : !error && (
        <>
          {/* Status Tabs */}
          <div className="orders-page__tabs">
            {TABS.map((tab) => {
              const tabCount = tab.value === 'all'
                ? orders.length
                : orders.filter(o => o.status === tab.value).length;
              return (
                <button
                  key={tab.value}
                  className={`orders-page__tab ${activeTab === tab.value ? 'orders-page__tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.value)}
                >
                  <span>{tab.label}</span>
                  <span className="orders-page__tab-badge">{tabCount}</span>
                </button>
              );
            })}
          </div>

          <div className="ap-card">
            {/* Filters Toolbar */}
            <div className="orders-page__toolbar">
              <div className="orders-page__search-wrap">
                <Search className="orders-page__search-icon" size={18} />
                <input
                  type="text"
                  placeholder="Search order #, customer name, email..."
                  className="ap-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="orders-page__filters">
                <select
                  className="ap-select"
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                >
                  <option value="all">All Payments</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>

                <div className="orders-page__date-filters">
                  <div className="orders-page__date-input-wrap">
                    <Calendar size={14} className="orders-page__date-icon" />
                    <input
                      type="date"
                      className="ap-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      title="Start date"
                    />
                  </div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>to</span>
                  <div className="orders-page__date-input-wrap">
                    <Calendar size={14} className="orders-page__date-icon" />
                    <input
                      type="date"
                      className="ap-input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      title="End date"
                    />
                  </div>
                </div>

                {(searchQuery || paymentFilter !== 'all' || startDate || endDate || activeTab !== 'all') && (
                  <button className="ap-btn ap-btn--ghost" onClick={handleClearFilters} style={{ fontSize: '12px' }}>
                    Reset Filters
                  </button>
                )}

                <span className="orders-page__count">
                  Found {filteredOrders.length} orders
                </span>
              </div>
            </div>

            {/* Orders listing representation */}
            {filteredOrders.length === 0 ? (
              <div className="ap-empty" style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ShoppingBag size={40} style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }} />
                <p className="ap-empty__title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-heading)' }}>No orders found.</p>
                <p className="ap-empty__desc" style={{ color: 'var(--color-text-muted)' }}>Create your first order.</p>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="ap-table-wrap orders-page__desktop-table">
                  <table className="ap-table">
                    <thead>
                      <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Payment Status</th>
                        <th>Order Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => {
                        const statusConfig = STATUS_MAP[o.status] || { label: o.status, badgeClass: 'ap-badge--gray' };
                        return (
                          <tr key={o.order_id}>
                            <td style={{ fontWeight: '700', fontFamily: 'monospace' }}>#{o.order_number}</td>
                            <td>
                              <div>
                                <div style={{ fontWeight: '600' }}>{o.customer_name}</div>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>@{o.username}</span>
                              </div>
                            </td>
                            <td>{formatDate(o.placed_at)}</td>
                            <td style={{ fontWeight: '600' }}>₹{Number(o.total_amount).toLocaleString('en-IN')}</td>
                            <td>
                              <div>
                                <span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: '700' }}>{o.payment_method}</span>
                                <div style={{ fontSize: '10px', color: o.payment_status === 'paid' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                  {o.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`ap-badge ${statusConfig.badgeClass}`} style={{ textTransform: 'capitalize' }}>
                                {statusConfig.label}
                              </span>
                            </td>
                            <td>
                              <div className="ap-actions" style={{ justifyContent: 'flex-end' }}>
                                <Link to={`/admin/orders/${o.order_id}`} className="ap-btn ap-btn--ghost" title="View order profile">
                                  <Eye size={14} />
                                  <span>View</span>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view responsive cards */}
                <div className="orders-page__mobile-list">
                  {filteredOrders.map((o) => {
                    const statusConfig = STATUS_MAP[o.status] || { label: o.status, badgeClass: 'ap-badge--gray' };
                    return (
                      <div key={o.order_id} className="orders-page__mobile-card">
                        <div className="orders-page__m-card-header">
                          <span style={{ fontWeight: '700', fontFamily: 'monospace', color: 'var(--color-primary)' }}>#{o.order_number}</span>
                          <span className={`ap-badge ${statusConfig.badgeClass}`} style={{ textTransform: 'capitalize' }}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <div className="orders-page__m-card-body">
                          <div className="orders-page__m-row">
                            <span className="orders-page__m-label">Customer</span>
                            <span className="orders-page__m-val">{o.customer_name} (@{o.username})</span>
                          </div>
                          <div className="orders-page__m-row">
                            <span className="orders-page__m-label">Date</span>
                            <span className="orders-page__m-val">{formatDate(o.placed_at)}</span>
                          </div>
                          <div className="orders-page__m-row">
                            <span className="orders-page__m-label">Amount</span>
                            <span className="orders-page__m-val" style={{ fontWeight: '700' }}>₹{Number(o.total_amount).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="orders-page__m-row">
                            <span className="orders-page__m-label">Payment</span>
                            <span className="orders-page__m-val">
                              {o.payment_method} • <span style={{ color: o.payment_status === 'paid' ? 'var(--color-success)' : 'var(--color-warning)', fontWeight: '600' }}>
                                {o.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="orders-page__m-card-actions">
                          <Link to={`/admin/orders/${o.order_id}`} className="ap-btn ap-btn--ghost" style={{ width: '100%', justifyContent: 'center' }}>
                            <Eye size={14} style={{ marginRight: '6px' }} />
                            <span>View details</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
