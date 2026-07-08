import { Link } from 'react-router-dom';
import { ImageWithFallback } from '../../../../components/ui/ImageWithFallback/index.jsx';
import { formatCurrency } from '../../../../utils/formatters.js';
import { productPath } from '../../../../constants/routes.js';
import './index.css';

/**
 * OrderItemRow — renders a single product line item within an order details layout.
 *
 * @param {object} item  The order item object containing quantity, unit_price, product_name, image_url, etc.
 */
export function OrderItemRow({ item }) {
  const { product_id, product_name, image_url, quantity, unit_price } = item;
  const lineTotal = quantity * unit_price;

  return (
    <div className="order-item-row">
      <Link
        to={productPath(product_id)}
        className="order-item-row__image-link"
        tabIndex={-1}
        aria-hidden="true"
      >
        <div className="order-item-row__image-wrap">
          <ImageWithFallback
            src={image_url}
            alt={product_name || 'Product'}
            className="order-item-row__image"
          />
        </div>
      </Link>

      <div className="order-item-row__details">
        <Link to={productPath(product_id)} className="order-item-row__name-link">
          <span className="order-item-row__name">{product_name}</span>
        </Link>
        <div className="order-item-row__price-qty">
          <span>{formatCurrency(unit_price)}</span>
          <span className="order-item-row__divider-dot">•</span>
          <span>Qty: {quantity}</span>
        </div>
      </div>

      <div className="order-item-row__total">
        <span>{formatCurrency(lineTotal)}</span>
      </div>
    </div>
  );
}
