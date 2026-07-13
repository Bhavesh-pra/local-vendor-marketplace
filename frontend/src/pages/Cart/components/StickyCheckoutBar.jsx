import React from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../../utils/formatters.js';
import { ROUTES } from '../../../constants/routes.js';
import './StickyCheckoutBar.css';

export function StickyCheckoutBar({ total, items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="sticky-checkout-bar">
      <div className="sticky-checkout-bar__content container">
        <div className="sticky-checkout-bar__info">
          <span className="sticky-checkout-bar__label">Grand Total</span>
          <span className="sticky-checkout-bar__value">{formatCurrency(total || 0)}</span>
        </div>
        <Link to={ROUTES.CHECKOUT} className="btn btn--primary sticky-checkout-bar__btn">
          Checkout →
        </Link>
      </div>
    </div>
  );
}
