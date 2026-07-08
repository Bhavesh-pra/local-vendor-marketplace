import React from 'react';
import PriceBox from './PriceBox.jsx';
import { SHIPPING_THRESHOLD } from '../../constants/pricing.js';
import './BuyBox.css';

export default function BuyBox({
  product,
  selectedVariant,
  quantity,
  onQuantityChange,
  onAddToCart,
  onBuyNow,
  isAdding = false,
  shipping,
}) {
  const activePrice = selectedVariant ? selectedVariant.selling_price : product.selling_price;
  const activeMrp = selectedVariant ? selectedVariant.mrp : product.mrp;
  const activeStock = selectedVariant ? selectedVariant.available_stock : (product.variants?.[0]?.available_stock ?? 0);

  const isOutOfStock = activeStock <= 0;
  const freeShipping = shipping?.free_shipping === 1 || product.free_shipping === 1;

  const handleIncrement = () => {
    if (quantity < Math.min(activeStock, 10)) {
      onQuantityChange(quantity + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      onQuantityChange(quantity - 1);
    }
  };

  return (
    <div className="buy-box-container">
      {/* 1. Price */}
      <PriceBox price={activePrice} mrp={activeMrp} />

      {/* 2. Free Delivery */}
      {freeShipping && (
        <div className="buy-box-delivery-row">
          <span className="free-delivery-badge">Free Delivery</span>
        </div>
      )}

      {/* 3. Quantity Stepper */}
      {!isOutOfStock && (
        <div className="buy-box-qty-group">
          <span className="qty-label">Quantity:</span>
          <div className="qty-stepper">
            <button className="qty-step-btn" onClick={handleDecrement} disabled={quantity <= 1}>-</button>
            <span className="qty-current-val">{quantity}</span>
            <button className="qty-step-btn" onClick={handleIncrement} disabled={quantity >= Math.min(activeStock, 10)}>+</button>
          </div>
        </div>
      )}

      {/* 4. Stock Urgency Status (Placed right above actions stack) */}
      {(isOutOfStock || activeStock <= 10) && (
        <div className="buy-box-stock-status">
          {isOutOfStock ? (
            <span className="stock-badge out-of-stock">Out of Stock</span>
          ) : activeStock <= 5 ? (
            <span className="stock-badge low-stock">Only {activeStock} left</span>
          ) : (
            <span className="stock-badge limited-stock">Limited Stock</span>
          )}
        </div>
      )}

      {/* 5, 6, 7. Primary Actions Stack */}
      <div className="buy-box-actions-stack">
        <button
          className="buy-box-btn add-to-cart-btn"
          disabled={isOutOfStock || isAdding}
          onClick={() => onAddToCart(quantity)}
        >
          {isAdding ? 'Adding...' : 'Add to Cart'}
        </button>
        <button
          className="buy-box-btn buy-now-btn"
          disabled={isOutOfStock || isAdding}
          onClick={() => onBuyNow(quantity)}
        >
          Buy Now
        </button>
        <button
          type="button"
          className="buy-box-btn wishlist-btn-flat"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          ♡ Add to Wishlist
        </button>
      </div>
    </div>
  );
}
