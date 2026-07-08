import React from 'react';
import './StickyPurchaseBar.css';

export default function StickyPurchaseBar({
  productName,
  price,
  selectedVariantDesc,
  isOutOfStock,
  onAddToCart,
  onBuyNow,
  loading = false
}) {
  return (
    <div className="sticky-purchase-bar-wrapper">
      <div className="sticky-purchase-bar-content">
        <div className="sticky-bar-info">
          <p className="sticky-bar-title">{productName}</p>
          <div className="sticky-bar-meta">
            <span className="sticky-bar-price">₹{parseFloat(price || 0).toLocaleString('en-IN')}</span>
            {selectedVariantDesc && (
              <span className="sticky-bar-variant">{selectedVariantDesc}</span>
            )}
          </div>
        </div>
        <div className="sticky-bar-actions">
          <button
            className="sticky-action-btn secondary"
            disabled={isOutOfStock || loading}
            onClick={onAddToCart}
          >
            Add to Cart
          </button>
          <button
            className="sticky-action-btn primary"
            disabled={isOutOfStock || loading}
            onClick={onBuyNow}
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
