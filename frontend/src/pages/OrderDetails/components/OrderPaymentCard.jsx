import React from 'react';
import { CreditCard, FileText } from 'lucide-react';
import './OrderPaymentCard.css';

export default function OrderPaymentCard({ order }) {
  const {
    payment_method,
    payment_status,
    notes // only render notes section if notes exist
  } = order;

  // Normalizing Payment Method label
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

  const getDisplayPaymentStatus = (status) => {
    const upper = status?.toUpperCase() || 'PENDING';
    if (upper === 'PAID') return 'Paid';
    if (upper === 'FAILED') return 'Failed';
    return 'Pending';
  };

  const normalizedStatus = payment_status?.toLowerCase() || 'pending';

  return (
    <div className="order-payment-card">
      <div className="order-payment-card__section">
        <div className="order-payment-card__title">
          <CreditCard size={16} />
          <span>Payment Details</span>
        </div>
        <div className="order-payment-card__content">
          <div className="order-payment-card__row">
            <span className="order-payment-card__label">Method</span>
            <span className="order-payment-card__value">{getDisplayPaymentMethod(payment_method)}</span>
          </div>
          <div className="order-payment-card__row">
            <span className="order-payment-card__label">Payment Status</span>
            <span className={`payment-status-tag payment-status-tag--${normalizedStatus}`}>
              {getDisplayPaymentStatus(payment_status)}
            </span>
          </div>
        </div>
      </div>

      {notes && notes.trim() && (
        <div className="order-payment-card__section order-payment-card__section--notes">
          <div className="order-payment-card__title">
            <FileText size={16} />
            <span>Order Notes</span>
          </div>
          <div className="order-payment-card__notes-content">
            <p className="order-payment-card__notes-text">"{notes.trim()}"</p>
          </div>
        </div>
      )}
    </div>
  );
}
