import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import './index.css';

/**
 * DiscoveryBar — cohesive shop control panel containing Search, Sort, Category Chips, and Product Count.
 *
 * @param {string} searchQuery
 * @param {Function} setSearchQuery
 * @param {{ id: number, name: string, slug: string }[]} categories
 * @param {string} activeCategory
 * @param {Function} setActiveCategory
 * @param {string} sortOption
 * @param {Function} setSortOption
 * @param {number|null} resultCount
 */
export function DiscoveryBar({
  searchQuery,
  setSearchQuery,
  categories = [],
  activeCategory,
  setActiveCategory,
  resultCount,
  isFiltersOpen,
  activeFiltersCount = 0,
  onToggleFilters,
}) {
  const sentinelRef = useRef(null);
  const [isSticky, setIsSticky] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(72);

  // Dynamically resolve `--header-height` token from CSS variables to avoid hardcoded offsets
  useEffect(() => {
    const rawVal = getComputedStyle(document.documentElement).getPropertyValue('--header-height');
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed) && parsed > 0) {
      setHeaderHeight(parsed);
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      {
        rootMargin: `-${headerHeight}px 0px 0px 0px`,
      }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [headerHeight]);

  return (
    <section className="discovery-bar" aria-label="Product Search and Filter Controls">
      {/* Sentinel for sticky detection */}
      <div ref={sentinelRef} className="discovery-bar__sentinel" />

      {/* Sticky Row Wrapper */}
      <div className={`discovery-bar__sticky-row-wrapper ${isSticky ? 'discovery-bar__sticky-row-wrapper--sticky' : ''}`}>
        <div className="discovery-bar__container">
          <div className="discovery-bar__search-sort-row">
            
            {/* Search Input Box */}
            <div className="discovery-bar__search-container">
              <Search className="discovery-bar__search-icon" size={18} aria-hidden="true" />
              <input
                id="discovery-search"
                type="search"
                className="discovery-bar__search-input"
                placeholder="Search for fashion, electronics and more..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
                inputMode="search"
                aria-label="Search products"
              />
              {searchQuery && (
                <button
                  className="discovery-bar__search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  type="button"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Categories Dropdown */}
            <div className="discovery-bar__sort-container">
              <select
                id="discovery-category-select"
                className="discovery-bar__sort-select"
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                aria-label="Filter by category"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="discovery-bar__sort-chevron" size={16} aria-hidden="true" />
            </div>

            {/* Filters Toggle Button */}
            {onToggleFilters && (
              <button
                className={`discovery-bar__toggle-sidebar-btn ${isFiltersOpen ? 'discovery-bar__toggle-sidebar-btn--active' : ''}`}
                onClick={onToggleFilters}
                aria-label={isFiltersOpen ? 'Hide filters' : 'Show filters'}
                aria-expanded={isFiltersOpen}
                type="button"
              >
                <SlidersHorizontal size={18} aria-hidden="true" />
                <span className="discovery-bar__toggle-label">
                  {isFiltersOpen ? 'Hide Filters' : 'Show Filters'}{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
                </span>
              </button>
            )}

          </div>
        </div>
      </div>

      {/* Non-sticky Controls */}
      <div className="discovery-bar__container">
        {/* Product Count (Left aligned, natural casing) */}
        {resultCount != null && (
          <div className="discovery-bar__count" aria-live="polite" aria-atomic="true">
            {searchQuery.trim() !== '' ? (
              <>
                Showing {resultCount} result{resultCount !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
              </>
            ) : (
              <>
                Showing {resultCount} product{resultCount !== 1 ? 's' : ''}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
