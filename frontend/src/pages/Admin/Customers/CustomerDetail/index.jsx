import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, ShieldCheck, Mail, Phone, MapPin, Calendar, ShoppingBag, DollarSign, Percent, User } from 'lucide-react';
import { adminService } from '../../../../services/adminService.js';
import { ROUTES } from '../../../../constants/routes.js';
import { useToast } from '../../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../../utils/extractErrorMessage.js';
import { getCustomerType } from '../../../../utils/customerHelper.js';
import './index.css';

export default function CustomerDetail() {
  useDocumentTitle('Customer Profile — ShopCart Admin');
  const { id } = useParams();
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toggling, setToggling] = useState(false);

  const fetchCustomerProfile = async () => {
    try {
      setLoading(true);
      const res = await adminService.getCustomerById(id);
      setData(res);
      setError(null);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch customer profile');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerProfile();
  }, [id]);

  const handleToggleBlock = async () => {
    if (!data?.customer) return;
    const currentStatus = data.customer.status;
    const targetStatus = currentStatus === 'inactive' ? 'active' : 'blocked';
    const actionLabel = targetStatus === 'blocked' ? 'block' : 'unblock';

    try {
      setToggling(true);
      await adminService.setCustomerStatus(data.customer.user_id, targetStatus);
      showToast('success', `Customer successfully ${actionLabel}ed`);
      setData(prev => ({
        ...prev,
        customer: {
          ...prev.customer,
          status: targetStatus === 'blocked' ? 'inactive' : 'active'
        }
      }));
    } catch (err) {
      const errMsg = extractErrorMessage(err, `Failed to ${actionLabel} customer`);
      showToast('error', errMsg);
    } finally {
      setToggling(false);
    }
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

  if (loading) {
    return (
      <div className="ap-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="customer-detail">
        <Link to={ROUTES.ADMIN_CUSTOMERS} className="ap-btn ap-btn--ghost customer-detail__back">
          <ArrowLeft size={16} style={{ marginRight: '8px' }} />
          <span>Back to Customers</span>
        </Link>
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)', marginTop: '20px' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error || 'Customer not found'}</p>
        </div>
      </div>
    );
  }

  const { customer, metrics, orders } = data;
  const isBlocked = customer.status === 'inactive';
  const customerType = getCustomerType(metrics.total_orders, metrics.total_spending);

  return (
    <div className="customer-detail">
      <header className="customer-detail__header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <Link to={ROUTES.ADMIN_CUSTOMERS} className="ap-btn ap-btn--ghost customer-detail__back" style={{ width: 'fit-content' }}>
            <ArrowLeft size={16} style={{ marginRight: '8px' }} />
            <span>Back to Customers</span>
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="ap-title">{customer.username}</h1>
              <span className={`ap-badge ${customerType.badgeClass}`} style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '700' }}>
                {customerType.label} Segment
              </span>
              <span className={`ap-badge ${isBlocked ? 'ap-badge--red' : 'ap-badge--green'}`} style={{ padding: '4px 10px', fontSize: '12px' }}>
                {isBlocked ? 'Blocked' : 'Active'}
              </span>
            </div>
            <button
              className={`ap-btn ${isBlocked ? 'ap-btn--success' : 'ap-btn--danger'}`}
              onClick={handleToggleBlock}
              disabled={toggling}
            >
              {isBlocked ? (
                <>
                  <ShieldCheck size={14} style={{ marginRight: '6px' }} />
                  <span>Unblock Customer</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={14} style={{ marginRight: '6px' }} />
                  <span>Block Customer Account</span>
                </>
              )}
            </button>
          </div>
          <p className="ap-subtitle">Customer ID: #{customer.user_id} • Registered since {new Date(customer.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="ap-stats-grid customer-detail__metrics">
        <div className="ap-stat-card" style={{ '--stat-color': 'hsl(243, 75%, 65%)', '--stat-bg': 'hsla(243,75%,65%,0.1)' }}>
          <div className="ap-stat-card__top">
            <span className="ap-stat-card__label">Total Orders</span>
            <div className="ap-stat-card__icon"><ShoppingBag size={20} /></div>
          </div>
          <div className="ap-stat-card__value">{metrics.total_orders}</div>
          <p className="customer-detail__val-meta">Total orders placed</p>
        </div>

        <div className="ap-stat-card" style={{ '--stat-color': 'hsl(162, 73%, 46%)', '--stat-bg': 'hsla(162,73%,46%,0.1)' }}>
          <div className="ap-stat-card__top">
            <span className="ap-stat-card__label">Total Spending</span>
            <div className="ap-stat-card__icon"><DollarSign size={20} /></div>
          </div>
          <div className="ap-stat-card__value">₹{Number(metrics.total_spending).toLocaleString('en-IN')}</div>
          <p className="customer-detail__val-meta">Excluding cancelled/returns</p>
        </div>

        <div className="ap-stat-card" style={{ '--stat-color': 'hsl(38, 88%, 52%)', '--stat-bg': 'hsla(38,88%,52%,0.1)' }}>
          <div className="ap-stat-card__top">
            <span className="ap-stat-card__label">Average Order Value</span>
            <div className="ap-stat-card__icon"><Percent size={20} /></div>
          </div>
          <div className="ap-stat-card__value">₹{Number(metrics.average_order_value).toLocaleString('en-IN')}</div>
          <p className="customer-detail__val-meta">Spending average per transaction</p>
        </div>

        <div className="ap-stat-card" style={{ '--stat-color': 'hsl(27, 90%, 55%)', '--stat-bg': 'hsla(27,90%,55%,0.1)' }}>
          <div className="ap-stat-card__top">
            <span className="ap-stat-card__label">Returned Orders</span>
            <div className="ap-stat-card__icon"><ShieldAlert size={20} /></div>
          </div>
          <div className="ap-stat-card__value">{metrics.return_count}</div>
          <p className="customer-detail__val-meta">Total returned packages count</p>
        </div>

        <div className="ap-stat-card" style={{ '--stat-color': 'hsl(270, 72%, 68%)', '--stat-bg': 'hsla(270,72%,68%,0.1)' }}>
          <div className="ap-stat-card__top">
            <span className="ap-stat-card__label">Customer Segment</span>
            <div className="ap-stat-card__icon"><User size={20} /></div>
          </div>
          <div className="ap-stat-card__value">
            <span className={`ap-badge ${customerType.badgeClass}`} style={{ fontSize: '14px', padding: '3px 8px', fontWeight: '700' }}>
              {customerType.label}
            </span>
          </div>
          <p className="customer-detail__val-meta">Calculated customer segment</p>
        </div>
      </div>

      <div className="customer-detail__grid">
        {/* Left Side: Contact info & Address */}
        <div className="customer-detail__left-col">
          <div className="ap-card customer-detail__section">
            <h3 className="ap-section-title">Customer Information</h3>
            <div className="customer-detail__info-list">
              <div className="customer-detail__info-item">
                <Mail size={16} className="customer-detail__info-icon" />
                <div>
                  <div className="customer-detail__info-label">Email Address</div>
                  <div className="customer-detail__info-value">{customer.email ? customer.email : <span className="missing-data-text">Not Provided</span>}</div>
                </div>
              </div>
              <div className="customer-detail__info-item">
                <Phone size={16} className="customer-detail__info-icon" />
                <div>
                  <div className="customer-detail__info-label">Phone Number</div>
                  <div className="customer-detail__info-value">{customer.phone ? customer.phone : <span className="missing-data-text">Not Provided</span>}</div>
                </div>
              </div>
              <div className="customer-detail__info-item">
                <Calendar size={16} className="customer-detail__info-icon" />
                <div>
                  <div className="customer-detail__info-label">Registration Date</div>
                  <div className="customer-detail__info-value">{formatDate(customer.created_at)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="ap-card customer-detail__section">
            <h3 className="ap-section-title">Shipping Address</h3>
            {customer.address_line_1 ? (
              <div className="customer-detail__address">
                <MapPin size={18} className="customer-detail__address-icon" />
                <div>
                  <div className="customer-detail__address-value" style={{ fontWeight: '600' }}>{customer.username}</div>
                  <div className="customer-detail__address-value">{customer.address_line_1}</div>
                  {customer.address_line_2 && <div className="customer-detail__address-value">{customer.address_line_2}</div>}
                  <div className="customer-detail__address-value">
                    {customer.city}, {customer.state} - {customer.postal_code}
                  </div>
                  <div className="customer-detail__address-value" style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '4px' }}>
                    Country Code: {customer.country_code}
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No registered shipping address details.</p>
            )}
          </div>
        </div>

        {/* Right Side: Order list & Products list */}
        <div className="customer-detail__right-col">
          <div className="ap-card customer-detail__section">
            <h3 className="ap-section-title">Purchase Order History</h3>
            {orders.length === 0 ? (
              <div className="ap-empty" style={{ padding: '24px 0' }}>
                <p>This customer hasn't placed any orders yet.</p>
              </div>
            ) : (
              <div className="customer-detail__orders-list">
                {orders.map((order) => {
                  let statusClass = 'ap-badge--yellow';
                  if (order.status === 'processing') statusClass = 'ap-badge--blue';
                  if (order.status === 'shipped') statusClass = 'ap-badge--purple';
                  if (order.status === 'delivered') statusClass = 'ap-badge--green';
                  if (order.status === 'cancelled') statusClass = 'ap-badge--red';
                  if (order.status === 'returned') statusClass = 'ap-badge--orange';

                  return (
                    <div key={order.order_id} className="customer-detail__order-card">
                      <div className="customer-detail__order-card-header">
                        <div>
                          <Link to={`/admin/orders/${order.order_id}`} className="customer-detail__order-num">
                            #{order.order_number}
                          </Link>
                          <span className="customer-detail__order-date">{formatDate(order.placed_at)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="customer-detail__order-total">₹{Number(order.total_amount).toLocaleString('en-IN')}</span>
                          <span className={`ap-badge ${statusClass}`} style={{ textTransform: 'capitalize' }}>
                            {order.status}
                          </span>
                        </div>
                      </div>

                      {/* Items nested */}
                      <div className="customer-detail__order-items">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="customer-detail__order-item-row">
                            <div className="customer-detail__item-info">
                              <span className="customer-detail__item-name">{item.product_name}</span>
                              {(item.size || item.color) && (
                                <span className="customer-detail__item-meta">
                                  ({[item.size, item.color].filter(Boolean).join(' / ')})
                                </span>
                              )}
                              <span className="customer-detail__item-sku">{item.sku}</span>
                            </div>
                            <div className="customer-detail__item-price">
                              {item.quantity} × ₹{Number(item.unit_price).toLocaleString('en-IN')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
