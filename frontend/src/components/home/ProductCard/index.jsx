import { Link } from 'react-router-dom';
import { ImageWithFallback } from '../../ui/ImageWithFallback/index.jsx';
import { Button } from '../../ui/Button/index.jsx';
import { formatCurrency } from '../../../utils/formatters.js';
import { productPath } from '../../../constants/routes.js';
import { SHIPPING_THRESHOLD } from '../../../constants/pricing.js';
import './index.css';

/**
 * ProductCard — vertical standing rectangle card replicating the requested design.
 * Structure:
 * - Image area with padding, gradient background, and a wishlist overlay button.
 * - Details area:
 *   - Bold title
 *   - Pill badges (Rating, Delivery status, Stock)
 *   - Muted product description (clamped)
 *   - Footer row: Price label + value on left, Add to Cart button on right.
 */
export function ProductCard({ product, onAddToCart, isAdding }) {
  const {
    product_id,
    product_name,
    selling_price,
    mrp,
    badge,
    image_url,
    average_rating,
    reviews_count,
    product_status,
  } = product;

  // Badge Priority: BESTSELLER > SALE > NEW
  const getPriorityBadge = (badgeStr) => {
    if (!badgeStr) return null;
    const upper = badgeStr.toUpperCase();
    if (upper.includes('BEST')) return 'Bestseller';
    if (upper.includes('SALE')) return 'Sale';
    if (upper.includes('NEW')) return 'New';
    return badgeStr;
  };
  const activeBadge = getPriorityBadge(badge);

  const totalStock = product.variants?.reduce((sum, v) => sum + (v.available_stock ?? 0), 0) ?? 0;
  const showLowStock = totalStock > 0 && totalStock <= 5;
  const isOutOfStock = product_status === 'inactive' || product_status === 'out_of_stock' || (product.variants && totalStock <= 0);
  const freeShipping = product.shipping?.free_shipping === 1 || product.free_shipping === 1;

  const discountPct = mrp && mrp > selling_price
    ? Math.round(((mrp - selling_price) / mrp) * 100)
    : 0;

  const ratingDisplay = typeof average_rating === 'number' ? average_rating.toFixed(1) : '0.0';

  return (
    <article className="product-card">
      {/* Badge Overlay (Top Left) */}
      {activeBadge && (
        <span className={`product-card__badge product-card__badge--${activeBadge.toLowerCase().replace(/\s+/g, '-')}`}>
          {activeBadge}
        </span>
      )}

      {/* Wishlist Button Overlay (Top Right) */}
      <button 
        className="product-card__wishlist-btn" 
        title="Add to Wishlist" 
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <span className="heart-icon">♡</span>
      </button>

      {/* Image Container */}
      <Link to={productPath(product_id)} className="product-card__image-link" tabIndex={-1} aria-hidden="true">
        <div className="product-card__image-wrap">
          <ImageWithFallback
            src={image_url}
            alt={product_name}
            className="product-card__image"
          />
        </div>
      </Link>

      {/* Body */}
      <div className="product-card__body">
        {/* Title */}
        <Link to={productPath(product_id)} className="product-card__name-link stretched-link">
          <h2 className="product-card__name">{product_name}</h2>
        </Link>

        {/* Price */}
        <div className="product-card__price-row">
          <span className="price-current">{formatCurrency(selling_price)}</span>
          {discountPct > 0 && (
            <span className="price-discount">-{discountPct}%</span>
          )}
        </div>

        {/* Rating */}
        {average_rating > 0 && (
          <div className="product-card__rating-row">
            <span className="product-card__rating">★ {ratingDisplay}{reviews_count >= 5 ? ` (${reviews_count})` : ''}</span>
          </div>
        )}

        {/* Delivery */}
        {freeShipping && (
          <div className="product-card__delivery-row">
            <span className="free-delivery-badge">Free Delivery</span>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <p className="product-card__description">
            {product.description}
          </p>
        )}

        {/* Stock Status (Urgency signal right before button) */}
        {(isOutOfStock || showLowStock) && (
          <div className="product-card__stock-row">
            {isOutOfStock ? (
              <span className="product-card__stock product-card__stock--oos">Out of stock</span>
            ) : (
              <span className="product-card__stock product-card__stock--low">Only {totalStock} left</span>
            )}
          </div>
        )}

        {/* CTA Button Block */}
        <div className="product-card__cta-block">
          <Button
            variant="primary"
            size="sm"
            loading={isAdding}
            disabled={isOutOfStock}
            onClick={() => onAddToCart(product)}
            aria-label={`Add ${product_name} to cart`}
            className="product-card__add-btn"
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </article>
  );
}
