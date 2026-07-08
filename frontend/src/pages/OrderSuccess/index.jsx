import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback/index.jsx';
import { getOrder } from '../../services/orderService.js';
import { formatCurrency } from '../../utils/formatters.js';
import { ROUTES } from '../../constants/routes.js';
import './index.css';

export default function OrderSuccess() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchOrderDetails = useCallback(async (id, currentAttempt = 0) => {
    try {
      const data = await getOrder(id);
      if (!data) {
        throw new Error('Order not found');
      }
      setOrder(data);
      setError(null);
      setLoading(false);
    } catch (err) {
      if (currentAttempt < 2) {
        // Retry after 500ms
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchOrderDetails(id, currentAttempt + 1);
        }, 500);
      } else {
        setError("Unable to load your order.");
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (orderId) {
      setLoading(true);
      setError(null);
      setRetryCount(0);
      fetchOrderDetails(orderId, 0);
    }
  }, [orderId, fetchOrderDetails]);

  const handleManualRetry = () => {
    if (orderId) {
      setLoading(true);
      setError(null);
      setRetryCount(0);
      fetchOrderDetails(orderId, 0);
    }
  };

  // Format date/time helper: e.g., "1 July 2026, 3:55 PM"
  const formatOrderDate = (dateStr) => {
    if (!dateStr) return 'Just now';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Just now';
      
      const day = date.getDate();
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      
      return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
    } catch (e) {
      return 'Just now';
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="order-success-page container">
          <div className="order-success-card skeleton-container">
            {/* Header skeleton */}
            <div className="skeleton skeleton-circle"></div>
            <div className="skeleton skeleton-title"></div>
            <div className="skeleton skeleton-text"></div>

            {/* Meta rows skeleton */}
            <div className="order-success-card__meta skeleton-meta">
              <div className="order-success-card__meta-item">
                <div className="skeleton skeleton-label"></div>
                <div className="skeleton skeleton-value"></div>
              </div>
              <div className="order-success-card__meta-item">
                <div className="skeleton skeleton-label"></div>
                <div className="skeleton skeleton-value"></div>
              </div>
            </div>

            {/* Timeline skeleton */}
            <div className="order-timeline">
              <div className="skeleton skeleton-title-sm"></div>
              <div className="order-timeline__steps">
                <div className="order-timeline__step">
                  <div className="skeleton skeleton-step-icon"></div>
                  <div className="skeleton skeleton-step-label"></div>
                </div>
                <div className="order-timeline__connector"></div>
                <div className="order-timeline__step">
                  <div className="skeleton skeleton-step-icon"></div>
                  <div className="skeleton skeleton-step-label"></div>
                </div>
                <div className="order-timeline__connector"></div>
                <div className="order-timeline__step">
                  <div className="skeleton skeleton-step-icon"></div>
                  <div className="skeleton skeleton-step-label"></div>
                </div>
                <div className="order-timeline__connector"></div>
                <div className="order-timeline__step">
                  <div className="skeleton skeleton-step-icon"></div>
                  <div className="skeleton skeleton-step-label"></div>
                </div>
              </div>
            </div>

            {/* Summary skeleton */}
            <div className="order-success-summary">
              <div className="skeleton skeleton-title-sm"></div>
              <div className="skeleton skeleton-summary-item"></div>
              <div className="skeleton skeleton-summary-item"></div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !order) {
    return (
      <PageLayout>
        <div className="order-success-page container">
          <div className="order-success-card order-success-card--error fade-in">
            <div className="order-success-card__badge-circle order-success-card__badge-circle--error">
              ✕
            </div>
            <h1 className="order-success-card__title">Unable to load your order</h1>
            <p className="order-success-card__desc">
              We're still confirming your purchase. Please wait a moment or try again.
            </p>
            <div className="order-success-card__actions">
              <button onClick={handleManualRetry} className="btn btn--primary order-success-card__btn">
                Retry
              </button>
              <Link to={ROUTES.ORDERS} className="btn btn--outline order-success-card__btn">
                Go to Orders
              </Link>
              <Link to={ROUTES.HOME} className="btn btn--outline order-success-card__btn">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Presentation formatted padded ID
  const paddedOrderId = `SC-${String(order.order_id).padStart(6, '0')}`;

  // Hierarchical date resolution fallback
  const placedDate = order.placed_at || order.created_at || order.updated_at || null;

  // Normalizing Payment Method label for display consistency
  const isCOD = order.payment_method?.toUpperCase() === 'COD' || order.payment_method?.toUpperCase() === 'CASH' || !order.payment_method;
  
  const getDisplayPaymentMethod = (method) => {
    if (!method) return 'Cash on Delivery (COD)';
    const upper = method.toUpperCase();
    if (upper === 'COD' || upper === 'CASH') {
      return 'Cash on Delivery (COD)';
    }
    if (upper === 'UPI') {
      return 'UPI / Net Banking';
    }
    return method;
  };

  return (
    <PageLayout>
      <div className="order-success-page container">
        <div className="order-success-card fade-in">
          {/* Header success bubble */}
          <div className="order-success-card__badge-circle">
            ✓
          </div>
          <h1 className="order-success-card__title">Order Placed Successfully</h1>
          <p className="order-success-card__desc">
            Thank you for shopping with ShopCart. Your transaction was completed successfully.
          </p>

          {/* Quick order metadata */}
          <div className="order-success-card__meta">
            <div className="order-success-card__meta-item">
              <span className="order-success-card__meta-label">Order ID</span>
              <span className="order-success-card__meta-value highlight-order">{paddedOrderId}</span>
            </div>
            <div className="order-success-card__meta-item">
              <span className="order-success-card__meta-label">Placed On</span>
              <span className="order-success-card__meta-value">{formatOrderDate(placedDate)}</span>
            </div>
          </div>

          {/* Visual Timeline Section */}
          <div className="order-timeline">
            <h4 className="order-timeline__title">Order Progress</h4>
            <div className="order-timeline__steps">
              <div className="order-timeline__step order-timeline__step--active">
                <span className="order-timeline__step-icon">✓</span>
                <span className="order-timeline__step-label">Order received</span>
              </div>
              <div className="order-timeline__connector order-timeline__connector--active"></div>
              <div className="order-timeline__step">
                <span className="order-timeline__step-icon">📦</span>
                <span className="order-timeline__step-label">Seller preparing order</span>
              </div>
              <div className="order-timeline__connector"></div>
              <div className="order-timeline__step">
                <span className="order-timeline__step-icon">🚚</span>
                <span className="order-timeline__step-label">Out for delivery</span>
              </div>
              <div className="order-timeline__connector"></div>
              <div className="order-timeline__step">
                <span className="order-timeline__step-icon">🏠</span>
                <span className="order-timeline__step-label">Delivered</span>
              </div>
            </div>
          </div>

          {/* "What happens next?" instructions checklist */}
          <div className="order-next-steps">
            <h4 className="order-next-steps__title">What happens next?</h4>
            <ul className="order-next-steps__list">
              <li>
                <span className="order-next-steps__bullet">•</span>
                <span>The seller will confirm and dispatch your order.</span>
              </li>
              <li>
                <span className="order-next-steps__bullet">•</span>
                <span>Your package will be prepared and packed securely.</span>
              </li>
              <li>
                <span className="order-next-steps__bullet">•</span>
                <span>Delivery expected within <strong>2–4 business days</strong>.</span>
              </li>
            </ul>
          </div>

          {/* Estimated delivery row */}
          <div className="order-success-card__delivery-info">
            <div className="order-success-card__delivery-row">
              <span className="order-success-card__delivery-icon">🕒</span>
              <div>
                <span className="order-success-card__delivery-label">Estimated Delivery</span>
                <span className="order-success-card__delivery-val">2–4 business days</span>
              </div>
            </div>
            <p className="order-success-card__delivery-note">
              You can track this order from the Orders page.
            </p>
          </div>

          {/* Compact summary card */}
          <div className="order-success-summary">
            <h4 className="order-success-summary__title">Items Purchased</h4>
            <ul className="order-success-summary__list">
              {order.items?.map((item) => {
                const hasVariants = item.size || (item.color && item.color !== 'Default' && item.color !== 'none');
                return (
                  <li key={item.order_item_id || item.variant_id} className="order-success-summary__item">
                    <div className="order-success-summary__item-left">
                      <div className="order-success-summary__item-thumb">
                        <ImageWithFallback src={item.image_url} alt={item.product_name} />
                      </div>
                      <div className="order-success-summary__item-info">
                        <span className="order-success-summary__item-name" title={item.product_name}>
                          {item.product_name}
                        </span>
                        <div className="order-success-summary__item-meta">
                          <span>Qty: {item.quantity}</span>
                          {hasVariants && (
                            <span className="order-success-summary__item-variants">
                              ({[item.size, item.color].filter(Boolean).join(' / ')})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="order-success-summary__item-price">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="order-success-summary__breakdown">
              <div className="order-success-summary__row">
                <span className="order-success-summary__label">Payment Method</span>
                <span className="order-success-summary__value">{getDisplayPaymentMethod(order.payment_method)}</span>
              </div>
              <div className="order-success-summary__row order-success-summary__row--total">
                <span className="order-success-summary__label order-success-summary__label--total">
                  {isCOD ? 'Total Payable' : 'Total Paid'}
                </span>
                <span className="order-success-summary__value order-success-summary__value--total">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Buttons redirects */}
          <div className="order-success-card__actions">
            <Link to={ROUTES.ORDERS} className="btn btn--primary order-success-card__btn">
              View Orders
            </Link>
            <Link to={ROUTES.HOME} className="btn btn--outline order-success-card__btn">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
