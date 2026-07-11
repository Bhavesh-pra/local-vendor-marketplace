import { useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import './index.css';

const PRICE_OPTIONS = [
  { label: 'Under ₹500',       value: 'under500' },
  { label: '₹500 – ₹2,000',    value: '500-2000' },
  { label: '₹2,000 – ₹5,000',  value: '2000-5000' },
  { label: '₹5,000+',          value: '5000+' },
];

const RATING_OPTIONS = [
  { label: '4★ & above', value: 4 },
  { label: '3★ & above', value: 3 },
];

export function FilterSidebar({
  desktopVisible = true,
  priceRange,
  onPriceRangeChange,
  minRating,
  onRatingChange,
  inStock,
  onInStockChange,
  onClearAll,
  isOpen,
  onClose,
  
  // Category & Brand Facets
  categories = [],
  activeCategory = 'all',
  onCategoryChange,
  brands = [],
  activeBrand = '',
  onBrandChange,
  loadingFacets = false,
}) {
  const [openSections, setOpenSections] = useState({
    categories: true,
    brands: true,
    price: true,
    rating: true,
    availability: true,
  });

  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeCount = [
    activeCategory !== 'all',
    activeBrand !== '',
    priceRange != null && priceRange !== '',
    minRating != null,
    inStock,
  ].filter(Boolean).length;

  const hasFilters = activeCount > 0;

  const handleCategoryClick = (slug) => {
    onCategoryChange(activeCategory === slug ? 'all' : slug);
  };

  const handleBrandClick = (brandName) => {
    onBrandChange(activeBrand === brandName ? '' : brandName);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`filter-sidebar-backdrop ${isOpen ? 'filter-sidebar-backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`filter-sidebar ${isOpen ? 'filter-sidebar--open' : ''} ${desktopVisible ? '' : 'filter-sidebar--desktop-hidden'}`}
        aria-label="Product filters"
      >
        {/* Header */}
        <div className="filter-sidebar__header">
          <div className="filter-sidebar__title-row">
            <SlidersHorizontal size={15} aria-hidden="true" />
            <span className="filter-sidebar__title">Filters</span>
            {activeCount > 0 && (
              <span className="filter-sidebar__count-badge">{activeCount}</span>
            )}
          </div>
          <div className="filter-sidebar__header-actions">
            {hasFilters && (
              <button
                type="button"
                className="filter-sidebar__clear-btn"
                onClick={onClearAll}
              >
                Clear all
              </button>
            )}
            {/* Mobile close */}
            <button
              type="button"
              className="filter-sidebar__mobile-close"
              onClick={onClose}
              aria-label="Close filters"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Category Section ── */}
        <div className="filter-sidebar__section">
          <button
            type="button"
            className="filter-sidebar__section-header"
            onClick={() => toggleSection('categories')}
            aria-expanded={openSections.categories}
          >
            <span>Category</span>
            <ChevronDown
              size={14}
              className={`filter-sidebar__chevron ${openSections.categories ? 'filter-sidebar__chevron--open' : ''}`}
            />
          </button>
          {openSections.categories && (
            <ul className="filter-sidebar__option-list">
              <li>
                <label className="filter-sidebar__option">
                  <input
                    type="radio"
                    name="category-filter"
                    className="filter-sidebar__radio"
                    checked={activeCategory === 'all'}
                    onChange={() => onCategoryChange('all')}
                  />
                  <span className="filter-sidebar__option-label">All Categories</span>
                </label>
              </li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <label className="filter-sidebar__option">
                    <input
                      type="radio"
                      name="category-filter"
                      className="filter-sidebar__radio"
                      checked={activeCategory === cat.slug}
                      onChange={() => handleCategoryClick(cat.slug)}
                    />
                    <span className="filter-sidebar__option-label">{cat.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Brand Section ── */}
        <div className="filter-sidebar__section">
          <button
            type="button"
            className="filter-sidebar__section-header"
            onClick={() => toggleSection('brands')}
            aria-expanded={openSections.brands}
          >
            <span>Brand</span>
            <ChevronDown
              size={14}
              className={`filter-sidebar__chevron ${openSections.brands ? 'filter-sidebar__chevron--open' : ''}`}
            />
          </button>
          {openSections.brands && (
            <>
              {loadingFacets ? (
                <div className="filter-sidebar__skeleton-wrapper" aria-label="Loading brands">
                  <div className="filter-sidebar__skeleton-line shimmer" style={{ width: '85%', height: '14px', margin: '8px 0' }} />
                  <div className="filter-sidebar__skeleton-line shimmer" style={{ width: '65%', height: '14px', margin: '8px 0' }} />
                  <div className="filter-sidebar__skeleton-line shimmer" style={{ width: '75%', height: '14px', margin: '8px 0' }} />
                </div>
              ) : (
                <ul className="filter-sidebar__option-list">
                  {brands.map((br) => {
                    const isDisabled = br.count === 0;
                    return (
                      <li key={br.name}>
                        <label className={`filter-sidebar__option ${isDisabled ? 'filter-sidebar__option--disabled' : ''}`}>
                          <input
                            type="radio"
                            name="brand-filter"
                            className="filter-sidebar__radio"
                            checked={activeBrand === br.name}
                            onChange={() => handleBrandClick(br.name)}
                          />
                          <span className="filter-sidebar__option-label">
                            {br.name} <span className="filter-sidebar__facet-count">({br.count})</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        {/* ── Price Section ── */}
        <div className="filter-sidebar__section">
          <button
            type="button"
            className="filter-sidebar__section-header"
            onClick={() => toggleSection('price')}
            aria-expanded={openSections.price}
          >
            <span>Price</span>
            <ChevronDown
              size={14}
              className={`filter-sidebar__chevron ${openSections.price ? 'filter-sidebar__chevron--open' : ''}`}
            />
          </button>
          {openSections.price && (
            <ul className="filter-sidebar__option-list">
              {PRICE_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <label className="filter-sidebar__option">
                    <input
                      type="radio"
                      name="price-range"
                      className="filter-sidebar__radio"
                      checked={priceRange === opt.value}
                      onChange={() =>
                        onPriceRangeChange(priceRange === opt.value ? null : opt.value)
                      }
                    />
                    <span className="filter-sidebar__option-label">{opt.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Rating Section ── */}
        <div className="filter-sidebar__section">
          <button
            type="button"
            className="filter-sidebar__section-header"
            onClick={() => toggleSection('rating')}
            aria-expanded={openSections.rating}
          >
            <span>Rating</span>
            <ChevronDown
              size={14}
              className={`filter-sidebar__chevron ${openSections.rating ? 'filter-sidebar__chevron--open' : ''}`}
            />
          </button>
          {openSections.rating && (
            <ul className="filter-sidebar__option-list">
              {RATING_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <label className="filter-sidebar__option">
                    <input
                      type="radio"
                      name="min-rating"
                      className="filter-sidebar__radio"
                      checked={minRating === opt.value}
                      onChange={() =>
                        onRatingChange(minRating === opt.value ? null : opt.value)
                      }
                    />
                    <span className="filter-sidebar__option-label">{opt.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Availability Section ── */}
        <div className="filter-sidebar__section">
          <button
            type="button"
            className="filter-sidebar__section-header"
            onClick={() => toggleSection('availability')}
            aria-expanded={openSections.availability}
          >
            <span>Availability</span>
            <ChevronDown
              size={14}
              className={`filter-sidebar__chevron ${openSections.availability ? 'filter-sidebar__chevron--open' : ''}`}
            />
          </button>
          {openSections.availability && (
            <ul className="filter-sidebar__option-list">
              <li>
                <label className="filter-sidebar__option">
                  <input
                    type="checkbox"
                    className="filter-sidebar__checkbox"
                    checked={inStock}
                    onChange={(e) => onInStockChange(e.target.checked)}
                  />
                  <span className="filter-sidebar__option-label">In Stock Only</span>
                </label>
              </li>
            </ul>
          )}
        </div>

        {/* Footer */}
        {hasFilters && (
          <div className="filter-sidebar__footer">
            <button
              type="button"
              className="filter-sidebar__clear-all-btn"
              onClick={onClearAll}
            >
              Clear All Filters
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
