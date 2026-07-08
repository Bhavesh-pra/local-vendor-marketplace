import React from 'react';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';
import './OrderDeliveryCard.css';

export default function OrderDeliveryCard({ status, placedAt, updatedAt }) {
  const lowerStatus = status?.toLowerCase() || 'pending';

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }); // e.g. "Jul 5"
    } catch {
      return '—';
    }
  };

  const getEstimatedWindow = (dateStr) => {
    if (!dateStr) return 'Estimated in 2-4 days';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Estimated in 2-4 days';
      const startEst = new Date(date.getTime() + 3 * 24 * 60 * 60 * 1000);
      const endEst = new Date(date.getTime() + 5 * 24 * 60 * 60 * 1000);
      
      const formatOption = { day: 'numeric', month: 'short' };
      const startStr = startEst.toLocaleDateString('en-US', formatOption);
      const endStr = endEst.toLocaleDateString('en-US', formatOption);
      
      return `${startStr} – ${endStr}`;
    } catch (e) {
      return 'Estimated in 2-4 days';
    }
  };

  if (lowerStatus === 'cancelled') {
    return (
      <div className="order-delivery-card order-delivery-card--cancelled">
        <div className="order-delivery-card__icon-wrap">
          <XCircle size={20} />
        </div>
        <div className="order-delivery-card__info">
          <span className="order-delivery-card__label">Order Status</span>
          <h3 className="order-delivery-card__date">Order Cancelled</h3>
        </div>
      </div>
    );
  }

  if (lowerStatus === 'delivered') {
    return (
      <div className="order-delivery-card order-delivery-card--delivered">
        <div className="order-delivery-card__icon-wrap">
          <CheckCircle size={20} />
        </div>
        <div className="order-delivery-card__info">
          <span className="order-delivery-card__label">Delivery Confirmed</span>
          <h3 className="order-delivery-card__date">
            Delivered on {formatDateShort(updatedAt || placedAt)}
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="order-delivery-card">
      <div className="order-delivery-card__icon-wrap">
        <Calendar size={20} />
      </div>
      <div className="order-delivery-card__info">
        <span className="order-delivery-card__label">Estimated Delivery</span>
        <h3 className="order-delivery-card__date">
          {getEstimatedWindow(placedAt)}
        </h3>
      </div>
    </div>
  );
}
