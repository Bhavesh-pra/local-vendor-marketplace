import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, RotateCcw, Lock, Tag, Truck } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters.js';
import { ROUTES } from '../../../../constants/routes.js';
import { useToast } from '../../../../hooks/useToast.js';
import './index.css';

export function CartSummary({
  items,
  summary,
  appliedCouponCode,
  onApplyCoupon,
  onRemoveCoupon
}) {
  const { showToast } = useToast();
  const [promoCode, setPromoCode] = useState('');

  const sellingSubtotal = summary.subtotal;
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = summary.shipping_fee;
  const tax = summary.tax_amount;
  const discountAmount = summary.coupon_savings;
  const total = summary.final_total;
  const isApplied = !!appliedCouponCode;

  const handleApplyPromo = async (e) => {
    e.preventDefault();
    if (!promoCode.trim()) {
      showToast('error', 'Please enter a promo code.');
      return;
    }
    try {
      await onApplyCoupon(promoCode.trim());
    } catch (err) {
      showToast('error', err.message || 'Failed to apply promo code.');
    }
  };

  const handleRemovePromo = () => {
    onRemoveCoupon();
    setPromoCode('');
  };

  return (
    <div className="cart-summary-container">
      <div className="cart-summary-card">
        <div className="cart-summary-card__header">
          <h2 className="cart-summary-card__title">Order summary</h2>
          <span className="cart-summary-card__qty">{totalQty} {totalQty === 1 ? 'item' : 'items'}</span>
        </div>

        {/* Free Shipping Badge */}
        <div className="cart-summary-card__shipping-badge-wrap">
          {shipping === 0 ? (
            <div className="cart-shipping-badge cart-shipping-badge--free">
              <Truck size={16} className="cart-shipping-badge__icon" />
              <span className="cart-shipping-badge__text">You've unlocked free shipping</span>
            </div>
          ) : (
            <div className="cart-shipping-badge cart-shipping-badge--paid">
              <Truck size={16} className="cart-shipping-badge__icon" />
              <span className="cart-shipping-badge__text">
                Add <strong>{formatCurrency(1000 - sellingSubtotal)}</strong> more to get free shipping
              </span>
            </div>
          )}
        </div>

        {/* Promo Code Input Form */}
        <form onSubmit={handleApplyPromo} className="cart-summary-card__promo-form">
          <div className="cart-promo-input-group">
            <Tag size={16} className="cart-promo-input-group__icon" />
            <input
              type="text"
              placeholder="Enter promo code"
              value={isApplied ? appliedCouponCode : promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="cart-promo-input-group__field"
              disabled={isApplied}
            />
            {isApplied ? (
              <button
                type="button"
                className="cart-promo-input-group__btn cart-promo-input-group__btn--remove"
                onClick={handleRemovePromo}
              >
                Remove
              </button>
            ) : (
              <button
                type="submit"
                className="cart-promo-input-group__btn"
              >
                Apply
              </button>
            )}
          </div>
        </form>

        {/* Calculation Rows */}
        <div className="cart-summary-card__rows">
          {/* MRP Subtotal */}
          <div className="cart-summary-card__row">
            <span className="cart-summary-card__label">Original Price (MRP)</span>
            <span className="cart-summary-card__value">{formatCurrency(summary.original_price)}</span>
          </div>

          {/* Product markdown discount */}
          {summary.discount_amount > 0 && (
            <div className="cart-summary-card__row cart-summary-card__row--savings">
              <span className="cart-summary-card__label">Product Discount</span>
              <span className="cart-summary-card__value cart-summary-card__value--savings">
                -{formatCurrency(summary.discount_amount)}
              </span>
            </div>
          )}

          {/* Selling Price Subtotal */}
          <div className="cart-summary-card__row">
            <span className="cart-summary-card__label">Subtotal</span>
            <span className="cart-summary-card__value">{formatCurrency(sellingSubtotal)}</span>
          </div>

          {/* Shipping */}
          <div className="cart-summary-card__row">
            <span className="cart-summary-card__label">Shipping</span>
            <span className="cart-summary-card__value">
              {shipping === 0 ? (
                <span className="cart-summary-card__value--free">Free</span>
              ) : (
                formatCurrency(shipping)
              )}
            </span>
          </div>

          {/* Coupon Discount */}
          {discountAmount > 0 && (
            <div className="cart-summary-card__row cart-summary-card__row--coupon">
              <span className="cart-summary-card__label">Coupon Savings</span>
              <span className="cart-summary-card__value cart-summary-card__value--savings">
                -{formatCurrency(discountAmount)}
              </span>
            </div>
          )}

          {/* Estimated tax */}
          <div className="cart-summary-card__row">
            <span className="cart-summary-card__label">Estimated tax</span>
            <span className="cart-summary-card__value">{formatCurrency(tax)}</span>
          </div>

          {/* Divider */}
          <div className="cart-summary-card__divider"></div>

          {/* Grand Total */}
          <div className="cart-summary-card__row cart-summary-card__row--total">
            <span className="cart-summary-card__label cart-summary-card__label--total">Total</span>
            <span className="cart-summary-card__value cart-summary-card__value--total">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Checkout CTA */}
        <Link to={ROUTES.CHECKOUT} className="btn btn--primary btn--lg cart-summary-card__checkout-btn">
          <span>Proceed to checkout</span>
          <span className="cart-summary-card__arrow">&rarr;</span>
        </Link>

        {/* SSL Badge */}
        <div className="cart-summary-card__ssl">
          <Lock size={12} className="cart-summary-card__ssl-icon" />
          <span className="cart-summary-card__ssl-text">Secure SSL encrypted checkout</span>
        </div>
      </div>

      {/* Side-by-side Trust Features */}
      <div className="cart-summary-features">
        <div className="cart-feature-card">
          <div className="cart-feature-card__icon-box">
            <RotateCcw size={18} className="cart-feature-card__icon" />
          </div>
          <div className="cart-feature-card__info">
            <span className="cart-feature-card__title">Easy returns</span>
            <span className="cart-feature-card__desc">No questions asked</span>
          </div>
        </div>

        <div className="cart-feature-card">
          <div className="cart-feature-card__icon-box">
            <ShieldCheck size={18} className="cart-feature-card__icon" />
          </div>
          <div className="cart-feature-card__info">
            <span className="cart-feature-card__title">Buyer protection</span>
            <span className="cart-feature-card__desc">100% guarantee</span>
          </div>
        </div>
      </div>
    </div>
  );
}
