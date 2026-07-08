import { useState } from 'react';
import { ShoppingCart, CreditCard, Plus, Minus, Check } from 'lucide-react';
import { StarRating } from '../../../../components/ui/StarRating/index.jsx';
import { Badge } from '../../../../components/ui/Badge/index.jsx';
import { Button } from '../../../../components/ui/Button/index.jsx';
import { Skeleton } from '../../../../components/ui/Skeleton/index.jsx';
import { formatCurrency } from '../../../../utils/formatters.js';
import './index.css';

/**
 * ProductInfoPanel — displays single product specifications, description, and purchase flow.
 *
 * @param {object}   product
 * @param {boolean}  loading
 * @param {boolean}  isAdding
 * @param {Function} onAddToCart
 * @param {Function} onBuyNow
 */
export function ProductInfoPanel({ product, loading, isAdding, onAddToCart, onBuyNow }) {
  const [quantity, setQuantity] = useState(1);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  if (loading) {
    return (
      <div className="product-info-panel product-info-panel--loading">
        <Skeleton width="100px" height="24px" borderRadius="var(--radius-sm)" />
        <Skeleton width="80%" height="48px" borderRadius="var(--radius-md)" style={{ marginBlock: 'var(--space-2)' }} />
        <Skeleton width="160px" height="20px" borderRadius="var(--radius-sm)" />
        <Skeleton width="120px" height="36px" borderRadius="var(--radius-md)" style={{ marginBlock: 'var(--space-3)' }} />
        <Skeleton width="100%" height="80px" borderRadius="var(--radius-md)" style={{ marginBlock: 'var(--space-3)' }} />
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBlock: 'var(--space-4)' }}>
          <Skeleton width="140px" height="48px" borderRadius="var(--radius-md)" />
          <Skeleton width="180px" height="48px" borderRadius="var(--radius-md)" />
          <Skeleton width="180px" height="48px" borderRadius="var(--radius-md)" />
        </div>
      </div>
    );
  }

  const {
    product_name,
    selling_price,
    average_rating,
    size_or_quantity,
    product_status,
    description,
    reviews_count,
  } = product;

  const isOutOfStock = product_status === 'inactive' || product_status === 'out_of_stock';

  const handleDecrement = () => setQuantity((prev) => Math.max(1, prev - 1));
  const handleIncrement = () => setQuantity((prev) => prev + 1);

  const handleQuantityChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1) setQuantity(val);
  };

  const handleQuantityBlur = () => {
    if (quantity < 1 || isNaN(quantity)) setQuantity(1);
  };

  // Check if description is long to show read more/less toggle
  const isLongDescription = description && description.length > 280;
  const displayDescription = isLongDescription && !isDescExpanded
    ? `${description.slice(0, 280)}...`
    : description;

  return (
    <div className="product-info-panel">
      {/* 1. Availability Badge */}
      <div className="product-info-panel__availability">
        {isOutOfStock ? (
          <Badge variant="error">Out of Stock</Badge>
        ) : (
          <Badge variant="success">In Stock</Badge>
        )}
      </div>

      {/* 2. Product Name / Title */}
      <h1 className="product-info-panel__name">{product_name}</h1>

      {/* 3. Rating (directly below name) */}
      <div className="product-info-panel__rating">
        <StarRating value={average_rating ?? 0} />
        <span className="product-info-panel__rating-text">
          {average_rating ? (
            <>
              <strong>{Number(average_rating).toFixed(1)}</strong>
              <span className="product-info-panel__rating-count">
                ({product.reviews?.length ?? reviews_count ?? 0} reviews)
              </span>
            </>
          ) : (
            <span className="product-info-panel__no-rating">No reviews yet</span>
          )}
        </span>
      </div>

      {/* 4. Price */}
      <div className="product-info-panel__price-box">
        <span className="product-info-panel__price">{formatCurrency(selling_price)}</span>
        {size_or_quantity && (
          <span className="product-info-panel__size">({size_or_quantity})</span>
        )}
      </div>

      {/* 5. Description (Comfortable width, line-height 1.6, interactive expansion) */}
      {description && (
        <div className="product-info-panel__desc">
          <p className="product-info-panel__desc-text">
            {displayDescription}
            {isLongDescription && (
              <button
                type="button"
                className="product-info-panel__read-more-btn"
                onClick={() => setIsDescExpanded(!isDescExpanded)}
              >
                {isDescExpanded ? ' Show less' : ' Read more'}
              </button>
            )}
          </p>
        </div>
      )}

      {/* 6. Purchase Actions */}
      <div className="product-info-panel__purchase-row">
        {!isOutOfStock && (
          <div className="product-info-panel__stepper-wrap">
            <label htmlFor="quantity-stepper" className="sr-only">
              Quantity
            </label>
            <div className="product-info-panel__stepper">
              <button
                type="button"
                className="product-info-panel__stepper-btn"
                onClick={handleDecrement}
                disabled={quantity <= 1 || isAdding}
                aria-label="Decrease quantity"
              >
                <Minus size={16} />
              </button>
              <input
                id="quantity-stepper"
                type="number"
                min="1"
                step="1"
                className="product-info-panel__stepper-input"
                value={quantity}
                onChange={handleQuantityChange}
                onBlur={handleQuantityBlur}
                disabled={isAdding}
              />
              <button
                type="button"
                className="product-info-panel__stepper-btn"
                onClick={handleIncrement}
                disabled={isAdding}
                aria-label="Increase quantity"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="product-info-panel__buttons-group">
          <Button
            variant="secondary"
            className="product-info-panel__action-btn"
            loading={isAdding}
            disabled={isOutOfStock}
            onClick={() => onAddToCart(quantity)}
          >
            <ShoppingCart size={18} aria-hidden="true" />
            <span>Add to Cart</span>
          </Button>

          <Button
            variant="primary"
            className="product-info-panel__action-btn"
            loading={isAdding}
            disabled={isOutOfStock}
            onClick={() => onBuyNow(quantity)}
          >
            <CreditCard size={18} aria-hidden="true" />
            <span>Buy Now</span>
          </Button>
        </div>
      </div>

      {/* 7. Key Highlights */}
      <div className="product-info-panel__highlights">
        <span className="product-info-panel__highlight-item">
          <Check size={14} className="product-info-panel__highlight-icon" aria-hidden="true" />
          <span>Secure Checkout</span>
        </span>
        <span className="product-info-panel__highlight-item">
          <Check size={14} className="product-info-panel__highlight-icon" aria-hidden="true" />
          <span>Fast Delivery</span>
        </span>
        <span className="product-info-panel__highlight-item">
          <Check size={14} className="product-info-panel__highlight-icon" aria-hidden="true" />
          <span>Verified Seller</span>
        </span>
      </div>
    </div>
  );
}
