import React from 'react';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { ImageWithFallback } from '../../../components/ui/ImageWithFallback/index.jsx';
import { formatCurrency } from '../../../utils/formatters.js';
import { productPath } from '../../../constants/routes.js';
import { Link } from 'react-router-dom';
import './SaveForLater.css';

export function SaveForLater({ savedItems, onMoveToCart, onRemoveSavedItem, isMoving, isDeleting }) {
  if (!savedItems || savedItems.length === 0) return null;

  return (
    <div className="save-for-later">
      <h2 className="save-for-later__title">Saved for Later ({savedItems.length})</h2>
      <div className="save-for-later__grid">
        {savedItems.map((item) => {
          const { id, product_id, product_name, image_url, unit_price, mrp, size, color, available_stock } = item;
          const hasVariants = size || (color && color !== 'Default' && color !== 'none');
          const isOutOfStock = available_stock === 0;

          return (
            <div key={id} className="save-for-later-card">
              <div className="save-for-later-card__content">
                {/* Image */}
                <div className="save-for-later-card__image-wrap">
                  <Link to={productPath(product_id)}>
                    <ImageWithFallback src={image_url} alt={product_name} className="save-for-later-card__image" />
                  </Link>
                </div>

                {/* Details */}
                <div className="save-for-later-card__details">
                  <Link to={productPath(product_id)} className="save-for-later-card__name-link">
                    <h3 className="save-for-later-card__name">{product_name}</h3>
                  </Link>

                  {hasVariants && (
                    <div className="save-for-later-card__variants">
                      {color && color !== 'Default' && color !== 'none' && <span>Color: {color}</span>}
                      {size && <span>Size: {size}</span>}
                    </div>
                  )}

                  <div className="save-for-later-card__price-row">
                    <span className="save-for-later-card__price">{formatCurrency(unit_price)}</span>
                    {mrp > unit_price && (
                      <span className="save-for-later-card__mrp">{formatCurrency(mrp)}</span>
                    )}
                  </div>

                  {isOutOfStock ? (
                    <span className="save-for-later-card__stock save-for-later-card__stock--oos">Out of stock</span>
                  ) : available_stock <= 5 ? (
                    <span className="save-for-later-card__stock save-for-later-card__stock--low">Only {available_stock} left</span>
                  ) : null}
                </div>
              </div>

              {/* Actions row */}
              <div className="save-for-later-card__actions">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm save-for-later-card__btn save-for-later-card__btn--move"
                  onClick={() => onMoveToCart(id)}
                  disabled={isMoving || isOutOfStock}
                >
                  <ShoppingCart size={13} />
                  <span>Move to Cart</span>
                </button>
                <button
                  type="button"
                  className="save-for-later-card__remove-btn"
                  onClick={() => onRemoveSavedItem(id)}
                  disabled={isDeleting}
                  aria-label="Remove saved item"
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
