import { Link } from 'react-router-dom';
import { Trash2, Minus, Plus } from 'lucide-react';
import { ImageWithFallback } from '../../../../components/ui/ImageWithFallback/index.jsx';
import { formatCurrency } from '../../../../utils/formatters.js';
import { productPath } from '../../../../constants/routes.js';
import './index.css';

/**
 * CartItemRow — displays a single cart item with interactive quantity stepper
 * and a remove action.
 *
 * @param {object} item               Merged cart item details
 * @param {function} onUpdateQuantity Callback to update quantity
 * @param {function} onRemoveItem     Callback to remove item from cart
 */
export function CartItemRow({ item, onUpdateQuantity, onRemoveItem }) {
  const { cart_item_id, product_id, product_name, image_url, quantity, unit_price } = item;
  const lineTotal = quantity * unit_price;

  const handleDecrement = () => {
    if (quantity > 1) {
      onUpdateQuantity(cart_item_id, quantity - 1);
    }
  };

  const handleIncrement = () => {
    onUpdateQuantity(cart_item_id, quantity + 1);
  };

  return (
    <div className="cart-item-row">
      {/* Product Image & Info */}
      <div className="cart-item-row__product">
        <Link
          to={productPath(product_id)}
          className="cart-item-row__image-link"
          tabIndex={-1}
          aria-hidden="true"
        >
          <div className="cart-item-row__image-wrap">
            <ImageWithFallback
              src={image_url}
              alt={product_name || 'Product'}
              className="cart-item-row__image"
            />
          </div>
        </Link>
        <div className="cart-item-row__info">
          <Link to={productPath(product_id)} className="cart-item-row__name-link">
            <span className="cart-item-row__name">{product_name || `Product #${product_id}`}</span>
          </Link>
          <span className="cart-item-row__unit-price">{formatCurrency(unit_price)} each</span>
        </div>
      </div>

      {/* Actions: Stepper, Price, Remove */}
      <div className="cart-item-row__actions">
        {/* Quantity Stepper */}
        <div className="cart-item-row__stepper-group">
          <span className="cart-item-row__label-mobile">Quantity</span>
          <div className="cart-item-row__stepper">
            <button
              type="button"
              className="cart-item-row__stepper-btn"
              onClick={handleDecrement}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus size={14} />
            </button>
            <span className="cart-item-row__stepper-val">{quantity}</span>
            <button
              type="button"
              className="cart-item-row__stepper-btn"
              onClick={handleIncrement}
              aria-label="Increase quantity"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Pricing & Delete */}
        <div className="cart-item-row__meta">
          <div className="cart-item-row__total-group">
            <span className="cart-item-row__label-mobile">Total</span>
            <span className="cart-item-row__total-value">{formatCurrency(lineTotal)}</span>
          </div>
          <button
            type="button"
            className="cart-item-row__remove-btn"
            onClick={() => onRemoveItem(cart_item_id)}
            aria-label="Remove item"
          >
            <Trash2 size={16} />
            <span className="cart-item-row__remove-text">Remove</span>
          </button>
        </div>
      </div>
    </div>
  );
}
