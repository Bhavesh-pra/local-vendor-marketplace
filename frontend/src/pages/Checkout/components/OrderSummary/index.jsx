import { calculateShipping, calculateTotal } from '../../../../utils/pricing.js';
import { formatCurrency } from '../../../../utils/formatters.js';
import { ImageWithFallback } from '../../../../components/ui/ImageWithFallback/index.jsx';
import { CheckoutTrustBar } from '../CheckoutTrustBar.jsx';
import { Button } from '../../../../components/ui/Button/index.jsx';
import './index.css';

/**
 * OrderSummary — read-only display of products being ordered, subtotal, savings, shipping, and total.
 * Exposes the Place Order button, which is disabled until the form is valid.
 *
 * @param {object[]} items       Merged list of cart items
 * @param {number}   subtotal    Pre-calculated selling price subtotal of the cart items
 * @param {boolean}  submitting  Whether the place order request is in-flight
 * @param {boolean}  isValid     Whether all required checkout form fields are valid
 */
export function OrderSummary({ items, subtotal, submitting, isValid }) {
  // Authoritative calculations
  const mrpSubtotal = items.reduce((sum, item) => sum + (item.mrp || item.unit_price) * item.quantity, 0);
  const sellingSubtotal = subtotal;
  const totalSavings = mrpSubtotal > sellingSubtotal ? mrpSubtotal - sellingSubtotal : 0;

  const shipping = calculateShipping(sellingSubtotal, items);
  const total = calculateTotal(sellingSubtotal, shipping, 0);

  // Button text determination
  let buttonText = 'Place Order';
  if (submitting) {
    buttonText = 'Processing...';
  } else if (!isValid) {
    buttonText = 'Complete Required Fields';
  }

  return (
    <div className="order-summary">
      <h2 className="order-summary__title">Your Order</h2>

      {/* Items list */}
      <ul className="order-summary__list">
        {items.map((item) => {
          const itemTotal = item.quantity * item.unit_price;
          const hasVariants = item.size || (item.color && item.color !== 'Default' && item.color !== 'none');
          
          return (
            <li key={item.cart_item_id || item.product_id} className="order-summary__item">
              <div className="order-summary__item-left">
                <div className="order-summary__item-thumbnail">
                  <ImageWithFallback
                    src={item.image_url}
                    alt={item.product_name}
                    className="order-summary__item-img"
                  />
                </div>
                <div className="order-summary__item-info">
                  <span className="order-summary__item-name" title={item.product_name}>
                    {item.product_name}
                  </span>
                  <div className="order-summary__item-meta">
                    <span className="order-summary__item-qty">Qty: {item.quantity}</span>
                    {hasVariants && (
                      <span className="order-summary__item-variants">
                        ({[item.size, item.color].filter(Boolean).join(' / ')})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="order-summary__item-price">{formatCurrency(itemTotal)}</span>
            </li>
          );
        })}
      </ul>

      {/* Pricing breakdown */}
      <div className="order-summary__breakdown">
        {/* Items Total (MRP) */}
        <div className="order-summary__row">
          <span className="order-summary__label">Items Total (MRP)</span>
          <span className="order-summary__value">{formatCurrency(mrpSubtotal)}</span>
        </div>

        {/* Savings */}
        {totalSavings > 0 && (
          <div className="order-summary__row order-summary__row--savings">
            <span className="order-summary__label">Discount / Savings</span>
            <span className="order-summary__value order-summary__value--savings">
              -{formatCurrency(totalSavings)}
            </span>
          </div>
        )}

        {/* Shipping */}
        <div className="order-summary__row">
          <span className="order-summary__label">Shipping</span>
          <span className="order-summary__value">
            {shipping === 0 ? (
              <span className="order-summary__free">FREE</span>
            ) : (
              formatCurrency(shipping)
            )}
          </span>
        </div>

        <hr className="order-summary__divider" />

        {/* Grand Total */}
        <div className="order-summary__row order-summary__row--total">
          <span className="order-summary__label order-summary__label--total">Grand Total</span>
          <span className="order-summary__value order-summary__value--total">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* Place Order CTA linked to the checkout-form */}
      <Button
        type="submit"
        form="checkout-form"
        variant="primary"
        size="lg"
        className="order-summary__submit-btn"
        loading={submitting}
        disabled={!isValid || submitting}
      >
        {buttonText}
      </Button>

      {/* Trust badges bar embedded inside OrderSummary */}
      <CheckoutTrustBar />
    </div>
  );
}

