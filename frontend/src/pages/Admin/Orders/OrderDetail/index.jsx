import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, User, CreditCard, MapPin, ClipboardList, CheckCircle2, Truck, ArrowRightLeft, XCircle, RefreshCw } from 'lucide-react';
import { adminService } from '../../../../services/adminService.js';
import { ROUTES } from '../../../../constants/routes.js';
import { useToast } from '../../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../../utils/extractErrorMessage.js';
import { STATUS_MAP } from '../index.jsx';
import './index.css';

export default function OrderDetail() {
  useDocumentTitle('Order Details — ShopCart Admin');
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      const data = await adminService.getOrderById(id);
      setOrder(data);
      setError(null);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch order details');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [id]);

  const handleQuickStatusUpdate = async (newStatus) => {
    try {
      setUpdating(true);
      await adminService.updateOrderStatus(id, newStatus);
      showToast('success', `Order status updated to ${newStatus}`);
      // reload
      const updated = await adminService.getOrderById(id);
      setOrder(updated);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to update order status');
      showToast('error', errMsg);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="ap-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="order-detail">
        <Link to={ROUTES.ADMIN_ORDERS} className="ap-btn ap-btn--ghost order-detail__back">
          <ArrowLeft size={16} />
          <span>Back to Orders</span>
        </Link>
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)', marginTop: '20px' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error || 'Order not found'}</p>
        </div>
      </div>
    );
  }

  const currentStatusConfig = STATUS_MAP[order.status] || { label: order.status, badgeClass: 'ap-badge--gray' };

  // Calculate timeline steps: Placed -> Processing -> Shipped -> Delivered -> Returned
  const getTimelineSteps = (status) => {
    return [
      {
        key: 'placed',
        label: 'Placed',
        done: true,
        active: status === 'pending',
        icon: ShoppingBag
      },
      {
        key: 'processing',
        label: 'Processing',
        done: ['processing', 'shipped', 'delivered', 'returned'].includes(status),
        active: status === 'processing',
        icon: ClipboardList
      },
      {
        key: 'shipped',
        label: 'Shipped',
        done: ['shipped', 'delivered', 'returned'].includes(status),
        active: status === 'shipped',
        icon: Truck
      },
      {
        key: 'delivered',
        label: 'Delivered',
        done: ['delivered', 'returned'].includes(status),
        active: status === 'delivered',
        icon: CheckCircle2
      },
      {
        key: 'returned',
        label: 'Returned',
        done: status === 'returned',
        active: status === 'returned',
        icon: ArrowRightLeft,
        isSpecial: true
      }
    ];
  };

  const timelineSteps = getTimelineSteps(order.status);

  return (
    <div className="order-detail">
      <header className="order-detail__header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <Link to={ROUTES.ADMIN_ORDERS} className="ap-btn ap-btn--ghost order-detail__back" style={{ width: 'fit-content' }}>
            <ArrowLeft size={16} style={{ marginRight: '6px' }} />
            <span>Back to Orders</span>
          </Link>
          <div className="order-detail__header-banner" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            marginTop: '8px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 className="ap-title" style={{ margin: 0, fontSize: '1.75rem' }}>Order #{order.order_number}</h1>
                <span className={`ap-badge ${currentStatusConfig.badgeClass}`} style={{ fontSize: '14px', padding: '4px 12px', textTransform: 'capitalize', fontWeight: '700' }}>
                  {currentStatusConfig.label}
                </span>
              </div>
              <div style={{ marginTop: '6px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                Placed on {new Date(order.placed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.5px' }}>Total Amount</div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--color-brand-secondary)' }}>
                ₹{Number(order.total_amount).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Cancelled Banner */}
      {order.status === 'cancelled' && (
        <div className="ap-card order-detail__cancelled-alert" style={{
          background: 'hsla(0, 80%, 62%, 0.03)',
          borderColor: 'hsla(0, 80%, 62%, 0.2)',
          borderLeft: '4px solid var(--color-danger)',
          padding: '16px',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <XCircle size={20} style={{ color: 'var(--color-danger)' }} />
            <p style={{ color: 'var(--color-danger)', margin: 0, fontWeight: '700', fontSize: '0.875rem' }}>
              Fulfillment Cancelled — This order was cancelled and cannot be processed further.
            </p>
          </div>
        </div>
      )}

      {/* Visual Step Timeline Tracker */}
      {order.status !== 'cancelled' && (
        <div className="ap-card order-detail__timeline-card">
          <h3 className="order-detail__timeline-title">Fulfillment Progress Timeline</h3>
          <div className="order-timeline">
            {timelineSteps.map((step, idx) => {
              const StepIcon = step.icon;
              return (
                <div key={step.key} className={`order-timeline__step ${step.done ? 'step--done' : ''} ${step.active ? 'step--active' : ''} ${step.isSpecial ? 'step--special' : ''}`}>
                  <div className="order-timeline__node-wrap">
                    <div className="order-timeline__node">
                      {step.active && step.key === 'processing' ? (
                        <Spinner size="xs" />
                      ) : (
                        <StepIcon size={14} />
                      )}
                    </div>
                  </div>
                  <div className="order-timeline__info">
                    <div className="order-timeline__label">{step.label}</div>
                  </div>
                  {idx < timelineSteps.length - 1 && (
                    <div className={`order-timeline__connector ${timelineSteps[idx + 1].done ? 'connector--done' : ''}`}></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="order-detail__grid">
        {/* Left Column: Details */}
        <div className="order-detail__left-col">
          {/* Items Card */}
          <div className="ap-card order-detail__section">
            <h2 className="ap-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={18} />
              <span>Order Items</span>
            </h2>
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Product & Variant details</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item) => (
                    <tr key={item.order_item_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={item.image_url || '/placeholder-product.svg'}
                            alt={item.product_name}
                            className="order-detail__img"
                            onError={(e) => {
                              e.target.src = '/placeholder-product.svg';
                            }}
                          />
                          <div>
                            <span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{item.product_name}</span>
                            <div className="order-detail__variant-details">
                              {item.sku && <span className="order-detail__variant-sku">{item.sku}</span>}
                              {item.size && <span className="order-detail__variant-meta">Size: {item.size}</span>}
                              {item.color && <span className="order-detail__variant-meta">Color: {item.color}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>₹{Number(item.unit_price).toLocaleString('en-IN')}</td>
                      <td>{item.quantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>
                        ₹{Number(item.line_total).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Block */}
            <div className="order-detail__totals">
              <div className="order-detail__totals-row">
                <span className="order-detail__label">Subtotal</span>
                <span className="order-detail__value">₹{Number(order.subtotal_amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="order-detail__totals-row">
                <span className="order-detail__label">Shipping</span>
                <span className="order-detail__value">₹{Number(order.shipping_amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="order-detail__totals-row">
                <span className="order-detail__label">Tax</span>
                <span className="order-detail__value">₹{Number(order.tax_amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="order-detail__totals-row order-detail__total-final">
                <span>Total Amount</span>
                <span>₹{Number(order.total_amount).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Customer Info Card */}
          <div className="ap-card order-detail__section">
            <h2 className="ap-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} />
              <span>Customer Information</span>
            </h2>
            <div className="order-detail__row-grid">
              <div className="order-detail__row">
                <span className="order-detail__label">Full Name</span>
                <span className="order-detail__value">{order.customer_name}</span>
              </div>
              <div className="order-detail__row">
                <span className="order-detail__label">Email ID</span>
                <span className="order-detail__value">{order.customer_email}</span>
              </div>
              <div className="order-detail__row">
                <span className="order-detail__label">Username</span>
                <span className="order-detail__value">
                  <Link to={`/admin/customers/${order.user_id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: '600' }}>
                    @{order.username}
                  </Link>
                </span>
              </div>
              <div className="order-detail__row">
                <span className="order-detail__label">Phone Number</span>
                <span className="order-detail__value">
                  {order.customer_phone ? order.customer_phone : <span className="missing-data-text">Not Provided</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery Address Card */}
          <div className="ap-card order-detail__section">
            <h2 className="ap-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} />
              <span>Shipping Address</span>
            </h2>
            <div style={{ lineHeight: '1.6' }}>
              <div className="order-detail__value" style={{ fontWeight: '600' }}>{order.customer_name}</div>
              <div className="order-detail__value">{order.address_line_1}</div>
              {order.address_line_2 && <div className="order-detail__value">{order.address_line_2}</div>}
              <div className="order-detail__value">
                {order.city}, {order.state} - {order.postal_code}
              </div>
              <div className="order-detail__value" style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Country Code: {order.country_code}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Requests */}
        <div className="order-detail__right-col">
          {/* Operational Quick Actions Card */}
          <div className="ap-card order-detail__section">
            <h2 className="ap-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={18} />
              <span>Fulfillment Actions</span>
            </h2>
            <div className="order-detail__actions-block" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* PENDING -> Process or Cancel */}
              {order.status === 'pending' && (
                <>
                  <button
                    className="ap-btn ap-btn--primary"
                    disabled={updating}
                    onClick={() => handleQuickStatusUpdate('processing')}
                  >
                    Process Order
                  </button>
                  <button
                    className="ap-btn ap-btn--danger"
                    disabled={updating}
                    onClick={() => handleQuickStatusUpdate('cancelled')}
                  >
                    Cancel Order
                  </button>
                </>
              )}

              {/* PROCESSING -> Ship or Cancel */}
              {order.status === 'processing' && (
                <>
                  <button
                    className="ap-btn ap-btn--primary"
                    disabled={updating}
                    onClick={() => handleQuickStatusUpdate('shipped')}
                  >
                    Ship Order
                  </button>
                  <button
                    className="ap-btn ap-btn--danger"
                    disabled={updating}
                    onClick={() => handleQuickStatusUpdate('cancelled')}
                  >
                    Cancel Order
                  </button>
                </>
              )}

              {/* SHIPPED -> Confirm Delivery */}
              {order.status === 'shipped' && (
                <button
                  className="ap-btn ap-btn--success"
                  disabled={updating}
                  onClick={() => handleQuickStatusUpdate('delivered')}
                >
                  Confirm Delivery
                </button>
              )}

              {/* DELIVERED -> Return Order */}
              {order.status === 'delivered' && (
                <button
                  className="ap-btn ap-btn--warning"
                  disabled={updating}
                  onClick={() => handleQuickStatusUpdate('returned')}
                  style={{ color: '#fff', background: 'var(--color-warning)' }}
                >
                  Return Order
                </button>
              )}

              {/* CANCELLED or RETURNED -> No actions */}
              {['cancelled', 'returned'].includes(order.status) && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px 0', border: '1px dashed var(--color-border)', borderRadius: '6px' }}>
                  Lifecycle finished. No actions available.
                </p>
              )}
            </div>
          </div>

          {/* Payment Status Card */}
          <div className="ap-card order-detail__section">
            <h2 className="ap-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} />
              <span>Payment Details</span>
            </h2>
            <div className="order-detail__row-grid" style={{ marginTop: '16px' }}>
              <div className="order-detail__row">
                <span className="order-detail__label">Method</span>
                <span className="order-detail__value" style={{ textTransform: 'uppercase' }}>{order.payment_method}</span>
              </div>
              <div className="order-detail__row">
                <span className="order-detail__label">Status</span>
                <span
                  className={`ap-badge ${
                    order.payment_status === 'paid' ? 'ap-badge--green' : 'ap-badge--yellow'
                  }`}
                  style={{ width: 'fit-content' }}
                >
                  {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Order Requests Card (if any) */}
          <div className="ap-card order-detail__section">
            <h2 className="ap-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={18} />
              <span>Customer Requests</span>
            </h2>
            {(!order.requests || order.requests.length === 0) ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '12px' }}>
                No active cancellation, return, or replacement requests.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                {order.requests.map((req) => {
                  let typeClass = 'ap-badge--blue';
                  if (req.request_type === 'cancel') typeClass = 'ap-badge--red';
                  if (req.request_type === 'return') typeClass = 'ap-badge--yellow';

                  let statusClass = 'ap-badge--yellow';
                  if (req.status === 'approved') statusClass = 'ap-badge--green';
                  if (req.status === 'rejected') statusClass = 'ap-badge--red';

                  return (
                    <div key={req.request_id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span className={`ap-badge ${typeClass}`} style={{ textTransform: 'capitalize' }}>
                          {req.request_type}
                        </span>
                        <span className={`ap-badge ${statusClass}`} style={{ textTransform: 'capitalize' }}>
                          {req.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '4px 0' }}>
                        <strong>Reason:</strong> {req.reason || 'None provided'}
                      </p>
                      {req.admin_note && (
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: '4px 0' }}>
                          <strong>Admin Note:</strong> {req.admin_note}
                        </p>
                      )}
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
