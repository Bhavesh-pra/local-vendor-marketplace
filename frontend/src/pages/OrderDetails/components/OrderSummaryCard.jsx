import React from 'react';
import { DollarSign } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters.js';
import './OrderSummaryCard.css';

export default function OrderSummaryCard({ order }) {
  const {
    subtotal_amount,
    shipping_amount,
    total_amount
  } = order;

  return (
    <div className="order-details-summary-card">
      <div className="order-details-summary-card__title">
        <DollarSign size={16} />
        <span>Price Summary</span>
      </div>

      <div className="order-details-summary-card__content">
        <div className="order-details-summary-card__row">
          <span className="order-details-summary-card__label">Items Total</span>
          <span className="order-details-summary-card__val">{formatCurrency(subtotal_amount)}</span>
        </div>
        
        <div className="order-details-summary-card__row">
          <span className="order-details-summary-card__label">Shipping Fee</span>
          <span className="order-details-summary-card__val">
            {shipping_amount === 0 ? (
              <span className="shipping-free-label">Free</span>
            ) : (
              formatCurrency(shipping_amount)
            )}
          </span>
        </div>

        <hr className="order-details-summary-card__divider" />

        <div className="order-details-summary-card__row order-details-summary-card__row--total">
          <span className="order-details-summary-card__label--total">Grand Total</span>
          <span className="order-details-summary-card__val--total">{formatCurrency(total_amount)}</span>
        </div>
      </div>
    </div>
  );
}
