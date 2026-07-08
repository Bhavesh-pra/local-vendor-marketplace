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
            <div className="checkout-delivery-card__price-status">
              {isFree ? (
                <>
                  <span className="checkout-delivery-card__free">✓ Free shipping applied</span>
                  <p className="checkout-delivery-card__subtext checkout-delivery-card__subtext--success">
                    This order qualifies for free delivery.
                  </p>
                </>
              ) : (
                <>
                  <span className="checkout-delivery-card__price">Shipping Charge: {formatCurrency(shipping)}</span>
                  {remainingForFree > 0 && (
                    <p className="checkout-delivery-card__subtext">
                      Add <strong>{formatCurrency(remainingForFree)}</strong> more to unlock free delivery.
                    </p>
                  )}
                </>
              )}
            </div>
            {hasFreeDeliveryProduct && isFree && (
              <p className="checkout-delivery-card__note">
                (Unlocked by an eligible product in your cart)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default CheckoutDeliveryCard;
