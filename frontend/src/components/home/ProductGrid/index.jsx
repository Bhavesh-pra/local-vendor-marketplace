import { useState, useEffect } from 'react';
import { ShoppingCart, SearchX } from 'lucide-react';
import { ProductCard } from '../ProductCard/index.jsx';
import { ProductCardSkeleton } from '../ProductCardSkeleton/index.jsx';
import { ErrorState } from '../../ui/ErrorState/index.jsx';
import './index.css';

/**
 * ProductGrid — responsive grid of ProductCard or Skeleton components.
 */
export function ProductGrid({
  products,
  loading,
  error,
  onRetry,
  onAddToCart,
  addingProductId,
  onClearFilters,
  
  // Empty states metadata
  activeCategory = 'all',
  hasActiveFilters = false,
  hasActiveSearch = false,

  // Search Quality additions
  didYouMean = null,
  trending = [],
  onSearch = () => {},
}) {
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      setRecentSearches(stored.slice(0, 5));
    } catch (_) {}
  }, [products]);

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (loading) {
    return (
      <div className="product-grid" aria-label="Loading products" aria-busy="true">
        {Array.from({ length: 8 }, (_, idx) => {
          const isDesktopOnly = idx >= 6;
          return (
            <div
              key={idx}
              className={isDesktopOnly ? 'product-card-skeleton--desktop-only' : ''}
            >
              <ProductCardSkeleton />
            </div>
          );
        })}
      </div>
    );
  }

  if (!products || products.length === 0) {
    const isFiltered = hasActiveFilters || hasActiveSearch;
    const isCategorySelected = activeCategory && activeCategory !== 'all';

    if (isFiltered) {
      return (
        <div className="product-grid-empty">
          <SearchX size={40} className="product-grid-empty__icon" strokeWidth={1.5} />
          <h3 className="product-grid-empty__heading">No products found</h3>
          <p className="product-grid-empty__body">
            Try removing filters, changing search terms, or browsing categories.
          </p>

          {/* Typo Correction Recovery Option */}
          {didYouMean && (
            <div className="empty-state__recovery-item empty-state__typo">
              <span>Did you mean: </span>
              <button
                type="button"
                className="empty-state__typo-link"
                onClick={() => onSearch(didYouMean)}
              >
                {didYouMean}
              </button>
            </div>
          )}

          {/* Popular Searches Recovery Option */}
          <div className="empty-state__recovery-item empty-state__popular">
            <h4 className="empty-state__recovery-title">Popular Searches</h4>
            <div className="empty-state__tags">
              {['iPhone', 'Samsung', 'Earbuds', 'Shoes'].map(tag => (
                <button
                  key={tag}
                  type="button"
                  className="empty-state__tag-btn"
                  onClick={() => onSearch(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Recent Searches Recovery Option */}
          {recentSearches.length > 0 && (
            <div className="empty-state__recovery-item empty-state__recents">
              <h4 className="empty-state__recovery-title">Recent Searches</h4>
              <div className="empty-state__tags">
                {recentSearches.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className="empty-state__tag-btn empty-state__tag-btn--recent"
                    onClick={() => onSearch(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear Filters Recovery Option */}
          {onClearFilters && (
            <button
              type="button"
              className="product-grid-empty__clear-btn"
              onClick={onClearFilters}
            >
              Clear All Filters
            </button>
          )}

          {/* Trending Products Recovery Option */}
          {trending && trending.length > 0 && (
            <div className="empty-state__recovery-item empty-state__trending">
              <h4 className="empty-state__recovery-title">Trending Products</h4>
              <div className="empty-state__trending-grid">
                {trending.map(prod => (
                  <ProductCard
                    key={prod.product_id}
                    product={prod}
                    onAddToCart={() => onAddToCart(prod)}
                    isAdding={addingProductId === prod.product_id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (isCategorySelected) {
      return (
        <div className="product-grid-empty">
          <SearchX size={40} className="product-grid-empty__icon" strokeWidth={1.5} />
          <h3 className="product-grid-empty__heading">No products available</h3>
          <p className="product-grid-empty__body">
            This category currently has no products.
          </p>
          {onClearFilters && (
            <button
              type="button"
              className="product-grid-empty__clear-btn"
              onClick={onClearFilters}
            >
              Return to Catalogue
            </button>
          )}
        </div>
      );
    }

    // Catalogue is empty
    return (
      <div className="product-grid-empty">
        <SearchX size={40} className="product-grid-empty__icon" strokeWidth={1.5} />
        <h3 className="product-grid-empty__heading">Catalogue Empty</h3>
        <p className="product-grid-empty__body">
          There are currently no products available in the shop catalogue.
        </p>
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
