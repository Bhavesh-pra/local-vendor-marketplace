import React from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ArrowRight } from 'lucide-react';
import OrderStatusBadge from '../OrderStatusBadge.jsx';
import { ImageWithFallback } from '../../../../components/ui/ImageWithFallback/index.jsx';
import { formatCurrency, formatDate } from '../../../../utils/formatters.js';
import './index.css';

export function OrderCard({ order }) {
  const {
    order_id,
    order_number,
    status,
    created_at, // maps placed_at from backend
    total_amount,
    payment_method,
    item_count,
    first_product_name,
    first_product_image
  } = order;

  // 1. Format order ID
  const paddedOrderId = `SC-${String(order_id).padStart(6, '0')}`;

  // 2. Format delivery date calculation: placed_at + 4 days
  const getEstimatedDeliveryText = (placedAtStr, orderStatus) => {
    const lowerStatus = orderStatus?.toLowerCase();
    if (lowerStatus === 'delivered') return 'Delivered';
    if (lowerStatus === 'cancelled') return 'Cancelled';
    if (!placedAtStr) return 'Estimated in 2–4 business days';
    try {
      const date = new Date(placedAtStr);
      if (isNaN(date.getTime())) return 'Estimated in 2–4 business days';
      const deliveryDate = new Date(date.getTime() + 4 * 24 * 60 * 60 * 1000);
      const options = { day: 'numeric', month: 'short' };
      return `Estimated by ${deliveryDate.toLocaleDateString('en-US', options)}`;
    } catch (e) {
      return 'Estimated in 2–4 business days';
    }
  };

  // 3. Format Payment Method label
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

  // 4. Quantity display summary
  const getItemsCountText = () => {
    const totalItems = item_count || 1;
    if (totalItems <= 1) return first_product_name || '1 Product';
    return `${first_product_name} +${totalItems - 1} more item${totalItems > 2 ? 's' : ''}`;
  };

  return (
    <div className="order-list-card fade-in">
      <div className="order-list-card__header">
        <div className="order-list-card__header-info">
          <span className="order-list-card__id">{paddedOrderId}</span>
          <span className="order-list-card__date">{formatDate(created_at)}</span>
        </div>
        <OrderStatusBadge status={status} />
      </div>

      <div className="order-list-card__body">
        <div className="order-list-card__thumb">
          <ImageWithFallback src={first_product_image} alt={first_product_name || 'Product'} />
        </div>
        <div className="order-list-card__details">
          <h4 className="order-list-card__item-title" title={first_product_name}>
            {getItemsCountText()}
          </h4>
          <div className="order-list-card__meta-info">
            <span className="order-list-card__price">{formatCurrency(total_amount)}</span>
            <span className="order-list-card__divider-dot">&bull;</span>
            <span className="order-list-card__payment">{getDisplayPaymentMethod(payment_method)}</span>
          </div>
          <span className="order-list-card__delivery">
            {getEstimatedDeliveryText(created_at, status)}
          </span>
        </div>
      </div>

      <div className="order-list-card__footer">
        <Link to={`/orders/${order_id}`} className="btn btn--primary order-list-card__btn-details">
          <span>View Details</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
