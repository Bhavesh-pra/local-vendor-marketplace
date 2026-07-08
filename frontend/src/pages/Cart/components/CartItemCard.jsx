import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Heart, Minus, Plus } from 'lucide-react';
import { ImageWithFallback } from '../../../components/ui/ImageWithFallback/index.jsx';
import { formatCurrency } from '../../../utils/formatters.js';
import { productPath } from '../../../constants/routes.js';
import './CartItemCard.css';

export function CartItemCard({ item, onUpdateQuantity, onRemoveItem, onSaveForLater, isSaving }) {
  const {
    cart_item_id,
    product_id,
    product_name,
    image_url,
    quantity,
    unit_price,
    mrp,
    size,
    color,
    available_stock,
    brand,
    average_rating,
    reviews_count,
    free_shipping
  } = item;

  const handleDecrement = () => {
    if (quantity > 1) {
      onUpdateQuantity(cart_item_id, quantity - 1);
    }
  };

  const handleIncrement = () => {
    if (quantity < available_stock) {
      onUpdateQuantity(cart_item_id, quantity + 1);
    }
  };

  const hasVariants = size || (color && color !== 'Default' && color !== 'none');

  return (
    <div className={`cart-item-card ${available_stock === 0 ? 'cart-item-card--oos' : ''}`}>
      {/* Product Image */}
      <div className="cart-item-card__image-container">
        <Link to={productPath(product_id)} tabIndex={-1} aria-hidden="true">
          <ImageWithFallback
            src={image_url}
            alt={product_name || 'Product'}
            className="cart-item-card__image"
          />
        </Link>
      </div>

      {/* Main Details Area */}
      <div className="cart-item-card__details">
        {/* Brand */}
        {brand && (
          <span className="cart-item-card__brand">{brand}</span>
        )}

        {/* Product Name */}
        <Link to={productPath(product_id)} className="cart-item-card__name-link">
          <h3 className="cart-item-card__name">{product_name}</h3>
        </Link>
        
        {/* Variants: Color • Size */}
        {hasVariants && (
          <div className="cart-item-card__variants">
            {color && color !== 'Default' && color !== 'none' && (
              <span className="cart-item-card__variant-item">
                <span className="cart-item-card__variant-label">Color</span> {color}
              </span>
            )}
            {color && color !== 'Default' && color !== 'none' && size && (
              <span className="cart-item-card__variant-separator">•</span>
            )}
            {size && (
              <span className="cart-item-card__variant-item">
                <span className="cart-item-card__variant-label">Size</span> {size}
              </span>
            )}
          </div>
        )}

        {/* Stars Rating Row */}
        <div className="cart-item-card__rating-row">
          {average_rating > 0 ? (
            <>
              <div className="cart-item-card__stars" aria-label={`Rating: ${average_rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`cart-item-card__star ${i < Math.round(average_rating) ? 'cart-item-card__star--filled' : ''}`}
                  >
                    ★
                  </span>
                ))}
              </div>
              {reviews_count > 0 && (
                <span className="cart-item-card__reviews-count">({reviews_count})</span>
              )}
            </>
          ) : (
            <div className="cart-item-card__stars-placeholder"></div>
          )}
        </div>

        {/* Delivery Estimate */}
        <div className="cart-item-card__delivery-est">
          {free_shipping === 1 ? (
            <span className="cart-item-card__free-shipping">Free Delivery</span>
          ) : (
            <span>Est. delivery: 2–4 days</span>
          )}
        </div>

        {/* Stock Status Badge */}
        <div className="cart-item-card__stock-status">
          {available_stock === 0 ? (
            <span className="cart-item-card__stock cart-item-card__stock--oos">
              <span className="cart-item-card__stock-dot cart-item-card__stock-dot--oos"></span>
              Out of stock
            </span>
          ) : available_stock <= 5 ? (
            <span className="cart-item-card__stock cart-item-card__stock--low">
              <span className="cart-item-card__stock-dot cart-item-card__stock-dot--low"></span>
              Only {available_stock} left
            </span>
          ) : (
            <span className="cart-item-card__stock cart-item-card__stock--in">
              <span className="cart-item-card__stock-dot cart-item-card__stock-dot--in"></span>
              In stock
            </span>
          )}
        </div>

        {/* Quantity Controls Stepper at bottom-left */}
        <div className="cart-item-card__stepper-container">
          <div className="cart-item-card__stepper">
            <button
              type="button"
              className="cart-item-card__stepper-btn"
              onClick={handleDecrement}
              disabled={quantity <= 1 || available_stock === 0}
              aria-label="Decrease quantity"
            >
              <Minus size={14} />
            </button>
            <span className="cart-item-card__stepper-val">{quantity}</span>
            <button
              type="button"
              className="cart-item-card__stepper-btn"
              onClick={handleIncrement}
              disabled={quantity >= available_stock || available_stock === 0}
              aria-label="Increase quantity"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Side: Pricing and Actions */}
      <div className="cart-item-card__right-panel">
        <div className="cart-item-card__pricing">
          <span className="cart-item-card__price">{formatCurrency(unit_price)}</span>
          {mrp > unit_price && (
            <span className="cart-item-card__mrp">{formatCurrency(mrp)}</span>
          )}
        </div>

        <div className="cart-item-card__actions">
          <button
            type="button"
            className="cart-item-card__action-btn cart-item-card__action-btn--wishlist"
            onClick={() => onSaveForLater(item)}
            disabled={isSaving}
            aria-label="Add to wishlist"
          >
            <Heart size={18} />
          </button>
          <button
            type="button"
            className="cart-item-card__action-btn cart-item-card__action-btn--remove"
            onClick={() => onRemoveItem(cart_item_id)}
            aria-label="Remove item"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
