import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, XCircle, ShoppingBag, Copy, Check, FileDown } from 'lucide-react';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { Spinner } from '../../components/ui/Spinner/index.jsx';
import { getOrder, cancelOrder, getOrderEvents } from '../../services/orderService.js';
import { formatDate } from '../../utils/formatters.js';
import { useToast } from '../../hooks/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { ROUTES } from '../../constants/routes.js';

// Order Components
import OrderTimeline from './components/OrderTimeline.jsx';
import OrderAddressCard from './components/OrderAddressCard.jsx';
import OrderItemsList from './components/OrderItemsList.jsx';
import OrderPaymentCard from './components/OrderPaymentCard.jsx';
import OrderSummaryCard from './components/OrderSummaryCard.jsx';
import OrderDeliveryCard from './components/OrderDeliveryCard.jsx';
import OrderStatusBadge from '../Orders/components/OrderStatusBadge.jsx';

// Phase 2C.2 & 2C.3 Components
import OrderStatusMessage from './components/OrderStatusMessage.jsx';
import OrderNotesCard from './components/OrderNotesCard.jsx';
import OrderSupportCard from './components/OrderSupportCard.jsx';
import InvoiceCard from './components/InvoiceCard.jsx';
import CancelOrderModal from './components/CancelOrderModal.jsx';
import OrderActivityCard from './components/OrderActivityCard.jsx';
import OrderUpdatesCard from './components/OrderUpdatesCard.jsx';

import './index.css';

export default function OrderDetails() {
  const { id } = useParams();
  const { showToast } = useToast();
  useDocumentTitle(`Order Details #${id}`);

  // Page level states
  const [order, setOrder] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);

  const fetchOrderDetails = useCallback(async (orderId, currentAttempt = 0) => {
    try {
      const data = await getOrder(orderId);
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
          fetchOrderDetails(orderId, currentAttempt + 1);
        }, 500);
      } else {
        setError('Order not found.');
        setLoading(false);
      }
    }
  }, []);

  const fetchEvents = useCallback(async (orderId) => {
    try {
      const data = await getOrderEvents(orderId);
      setEvents(data || []);
    } catch (err) {
      console.error('Failed to load order events:', err.message);
    }
  }, []);

  useEffect(() => {
    if (id) {
      setLoading(true);
      setError(null);
      fetchOrderDetails(id, 0);
      fetchEvents(id);
    }
  }, [id, fetchOrderDetails, fetchEvents]);

  // Handle Copy Order Number
  const handleCopyOrderNumber = () => {
    if (!order?.order_number) return;
    navigator.clipboard.writeText(order.order_number);
    setCopiedOrderId(true);
    showToast('success', 'Order number copied to clipboard!');
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  // Handle Cancellation confirm from modal
  const handleCancelConfirm = async () => {
    setIsCancelModalOpen(false);
    setCancelling(true);
    try {
      await cancelOrder(id);
      showToast('success', 'Order cancelled successfully!');
      
      // Update local order status immediately to trigger success state
      setOrder((prev) => ({
        ...prev,
        status: 'cancelled',
        updated_at: new Date().toISOString()
      }));
      
      // Refresh event logs
      fetchEvents(id);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to cancel order.';
      showToast('error', msg);
    } finally {
      setCancelling(false);
    }
  };

  const handleManualRetry = () => {
    if (id) {
      setLoading(true);
      setError(null);
      fetchOrderDetails(id, 0);
      fetchEvents(id);
    }
  };

  // Order Age formatting
  const formatOrderAge = (placedAt) => {
    if (!placedAt) return '';
    try {
      const diffMs = new Date() - new Date(placedAt);
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Placed just now';
      if (diffMins < 60) return `Placed ${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
      if (diffHours < 24) return `Placed ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      return `Placed ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="order-details-page__loading">
          <Spinner size="lg" />
          <p className="order-details-page__loading-text">Loading order details...</p>
        </div>
      </PageLayout>
    );
  }

  if (error || !order) {
    return (
      <PageLayout>
        <div className="order-details-page container">
          <div className="order-details-error-card fade-in">
            <div className="order-details-error-card__badge">✕</div>
            <h1 className="order-details-error-card__title">Order Not Found</h1>
            <p className="order-details-error-card__desc">
              We couldn't retrieve the details for order SC-{String(id).padStart(6, '0')}. Please verify the URL or return to your orders dashboard.
            </p>
            <div className="order-details-error-card__actions">
              <button onClick={handleManualRetry} className="btn btn--primary order-details-error-card__btn" type="button">
                Retry Load
              </button>
              <Link to={ROUTES.ORDERS} className="btn btn--outline order-details-error-card__btn">
                Back to Orders
              </Link>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const paddedOrderId = `SC-${String(order.order_id).padStart(6, '0')}`;
  const lowerStatus = order.status?.toLowerCase();
  const placedDate = order.placed_at || order.created_at || order.updated_at || null;

  return (
    <PageLayout>
      <div className="order-details-page container">
        {/* Back Link & Header info */}
        <div className="order-details-page__header">
          <Link to={ROUTES.ORDERS} className="order-details-page__back-link">
            <ArrowLeft size={16} />
            <span>Back to Orders</span>
          </Link>
          
          <div className="order-details-page__title-row">
            <div className="order-details-page__title-and-badge">
              <h1 className="order-details-page__title">{paddedOrderId}</h1>
              <button 
                onClick={handleCopyOrderNumber} 
                className="order-details-page__copy-btn"
                title="Copy order number"
                type="button"
              >
                {copiedOrderId ? <Check size={14} className="order-details-page__copy-icon--success" /> : <Copy size={14} />}
              </button>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="order-details-page__meta-info">
              <p className="order-details-page__subtitle">
                Placed on {formatDate(placedDate)}
              </p>
              <p className="order-details-page__age">
                {formatOrderAge(placedDate)}
              </p>
            </div>
          </div>
        </div>

        <div className="order-details-page__content">
          {/* Left Column: Timeline, Status Message Card, Items List */}
          <div className="order-details-page__main-col">
            <OrderTimeline status={order.status} />
            
            <OrderStatusMessage status={order.status} />
            
            <OrderItemsList items={order.items} orderId={id} onRefresh={() => fetchOrderDetails(id, 0)} />
          </div>

          {/* Right Column: Sidebar ordered layout */}
          <div className="order-details-page__sidebar-col">
            {/* 1. Delivery Card */}
            <OrderDeliveryCard
              status={order.status}
              placedAt={placedDate}
              updatedAt={order.updated_at}
            />

            {/* 2. Shipping Information */}
            <OrderAddressCard order={order} />

            {/* Conditionally rendered Order Notes Card */}
            <OrderNotesCard notes={order.notes} />
            
            {/* 3. Payment Details */}
            <OrderPaymentCard order={order} />
            
            {/* 4. Price Summary */}
            <OrderSummaryCard order={order} />

            {/* 5. Activity Feed */}
            <OrderActivityCard events={events} />

            {/* Order Updates Notification Info */}
            <OrderUpdatesCard />

            {/* 6. Invoice Card */}
            <InvoiceCard />

            {/* 7. Action Bar & Support Card */}
            <div className="order-details-actions">
              {/* Cancel option for pending orders only */}
              {lowerStatus === 'pending' && (
                <div className="order-details-actions__wrap">
                  <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(true)}
                    className="btn btn--outline order-details-actions__btn-cancel"
                    disabled={cancelling}
                  >
                    <XCircle size={16} />
                    <span>Cancel Order</span>
                  </button>
                </div>
              )}

              {/* Continue Shopping option for cancelled orders */}
              {lowerStatus === 'cancelled' && (
                <Link to={ROUTES.HOME} className="btn btn--primary order-details-actions__btn-shop">
                  <ShoppingBag size={16} />
                  <span>Continue Shopping</span>
                </Link>
              )}

              {/* Action layout for delivered orders */}
              {lowerStatus === 'delivered' && (
                <div className="order-details-actions__delivered-wrap">
                  <button
                    type="button"
                    className="btn btn--primary order-details-actions__btn-reorder-placeholder"
                    disabled
                  >
                    <RefreshCw size={14} />
                    <span>Reorder (Coming Soon)</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline order-details-actions__btn-invoice-placeholder"
                    disabled
                  >
                    <FileDown size={14} />
                    <span>Download Invoice (Coming Soon)</span>
                  </button>
                </div>
              )}
            </div>

            <OrderSupportCard />
          </div>
        </div>
      </div>

      {/* Confirmation Modal overlay */}
      <CancelOrderModal 
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelConfirm}
        isCancelling={cancelling}
      />
    </PageLayout>
  );
}
