import React from 'react';
import { Calendar, Truck } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters.js';
import './CheckoutDeliveryCard.css';

export function CheckoutDeliveryCard({ shipping, items = [], subtotal }) {
  const hasFreeDeliveryProduct = items.some(item => item.free_shipping === 1);
  const isFree = shipping === 0;

  // Calculate amount needed to get free shipping
  const remainingForFree = 1000 - (subtotal || 0);

  return (
    <div className="checkout-delivery-card">
      <div className="checkout-delivery-card__header">
        <Truck className="checkout-delivery-card__icon-truck" size={18} />
        <h4 className="checkout-delivery-card__title">Delivery Information</h4>
      </div>

      <div className="checkout-delivery-card__body">
        {/* Estimated delivery row */}
        <div className="checkout-delivery-card__row">
          <Calendar className="checkout-delivery-card__icon" size={16} />
          <div>
            <span className="checkout-delivery-card__label">Estimated Delivery</span>
            <span className="checkout-delivery-card__value">2 – 4 business days</span>
            <p className="checkout-delivery-card__delivery-subtext">
              Orders are usually delivered within 2–4 business days. Tracking details will be available after order placement.
            </p>
          </div>
        </div>

        {/* Shipping charges row */}
        <div className="checkout-delivery-card__row">
          <div className="checkout-delivery-card__shipping-wrap">
            <span className="checkout-delivery-card__label">Shipping Charges</span>
            
            {isFree ? (
              <div className="checkout-shipping-badge checkout-shipping-badge--free">
                <span className="checkout-shipping-badge__text">✓ Free shipping applied</span>
                {hasFreeDeliveryProduct && (
                  <span className="checkout-shipping-badge__sub"> (Unlocked by an eligible product)</span>
                )}
              </div>
            ) : (
              <div className="checkout-shipping-badge checkout-shipping-badge--paid">
                <span className="checkout-shipping-badge__text">
                  Shipping Charge: <strong>{formatCurrency(shipping)}</strong>
                </span>
                {remainingForFree > 0 && (
                  <span className="checkout-shipping-badge__sub">
                    {' • '}Add <strong>{formatCurrency(remainingForFree)}</strong> more for free delivery
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default CheckoutDeliveryCard;
