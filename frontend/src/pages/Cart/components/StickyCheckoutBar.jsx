import React from 'react';
import { Link } from 'react-router-dom';
import { calculateShipping, calculateTax, calculateTotal } from '../../../utils/pricing.js';
import { formatCurrency } from '../../../utils/formatters.js';
import { ROUTES } from '../../../constants/routes.js';
import './StickyCheckoutBar.css';

export function StickyCheckoutBar({ items }) {
  if (!items || items.length === 0) return null;

  // Authoritative calculations
  const sellingSubtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const shipping = calculateShipping(sellingSubtotal, items);
  const total = calculateTotal(sellingSubtotal, shipping, 0);

  return (
    <div className="sticky-checkout-bar">
      <div className="sticky-checkout-bar__content container">
        <div className="sticky-checkout-bar__info">
          <span className="sticky-checkout-bar__label">Grand Total</span>
          <span className="sticky-checkout-bar__value">{formatCurrency(total)}</span>
        </div>
        <Link to={ROUTES.CHECKOUT} className="btn btn--primary sticky-checkout-bar__btn">
          Checkout →
        </Link>
      </div>
    </div>
  );
}
