import { ShoppingCart, SearchX } from 'lucide-react';
import { ProductCard } from '../ProductCard/index.jsx';
import { ProductCardSkeleton } from '../ProductCardSkeleton/index.jsx';
import { ErrorState } from '../../ui/ErrorState/index.jsx';
import './index.css';

const SKELETON_COUNT = 10;

/**
 * ProductGrid — responsive grid of ProductCard or Skeleton components.
 *
 * @param {object[]}  products
 * @param {boolean}   loading
 * @param {string}    [error]
 * @param {Function}  onRetry
 * @param {Function}  onAddToCart
 * @param {number}    [addingProductId]  ID of the product currently being added
 * @param {Function}  [onClearFilters]   Called when user clicks "Clear All Filters" in empty state
 */
export function ProductGrid({
  products,
  loading,
  error,
  onRetry,
  onAddToCart,
  addingProductId,
  onClearFilters,
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (loading) {
    return (
      <div className="product-grid" aria-label="Loading products" aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="product-grid-empty">
        <SearchX size={40} className="product-grid-empty__icon" strokeWidth={1.5} />
        <h3 className="product-grid-empty__heading">No products found</h3>
        <p className="product-grid-empty__body">
          We couldn't find anything matching your filters.
        </p>
        <ul className="product-grid-empty__tips">
          <li>Try removing some filters</li>
          <li>Browse a different category</li>
          <li>Clear your search and start fresh</li>
        </ul>
        {onClearFilters && (
          <button
            type="button"
            className="product-grid-empty__clear-btn"
            onClick={onClearFilters}
          >
            Clear All Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="product-grid" id="products">
      {products.map((product) => (
        <ProductCard
          key={product.product_id}
          product={product}
          onAddToCart={onAddToCart}
          isAdding={addingProductId === product.product_id}
        />
      ))}
    </div>
  );
}
