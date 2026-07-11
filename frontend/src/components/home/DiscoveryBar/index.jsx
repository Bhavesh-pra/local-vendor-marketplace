import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { getProductSuggestions } from '../../../services/productService.js';
import { useTelemetry } from '../../../hooks/useTelemetry.js';
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
  onOpenSort,
}) {
  const { trackEvent } = useTelemetry();
  const sentinelRef = useRef(null);
  const containerRef = useRef(null);
  const suggestionsAbortRef = useRef(null);
  const [isSticky, setIsSticky] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(72);
  
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // Reset index when suggestions or searchQuery changes
  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [suggestions, searchQuery]);

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

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    setRecentSearches(stored);
  }, [showSuggestions]);

  // Debounced search suggestions fetch
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (suggestionsAbortRef.current) {
        suggestionsAbortRef.current.abort();
      }

      const controller = new AbortController();
      suggestionsAbortRef.current = controller;

      try {
        const data = await getProductSuggestions(searchQuery, { signal: controller.signal });
        setSuggestions(data);
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError' || err.message === 'canceled') {
          return;
        }
        console.error('Failed to load suggestions:', err);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (suggestionsAbortRef.current) {
        suggestionsAbortRef.current.abort();
      }
    };
  }, [searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveRecentSearch = (term) => {
    if (!term || !term.trim()) return;
    const clean = term.trim();
    const stored = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    const updated = [clean, ...stored.filter(x => x !== clean)].slice(0, 5);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
    setRecentSearches(updated);
  };

  const handleSuggestionClick = (term) => {
    setSearchQuery(term);
    saveRecentSearch(term);
    setShowSuggestions(false);
    trackEvent('search_suggestion_click', {
      metadata: { query: term }
    });
  };

  const handleClearRecent = (e) => {
    e.stopPropagation();
    localStorage.removeItem('recentSearches');
    setRecentSearches([]);
  };

  const handleKeyDown = (e) => {
    const currentList = searchQuery.trim().length >= 3 ? suggestions : recentSearches;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => 
        prev < currentList.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      e.target.blur();
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < currentList.length) {
        e.preventDefault();
        handleSuggestionClick(currentList[activeSuggestionIndex]);
      } else {
        saveRecentSearch(searchQuery);
        setShowSuggestions(false);
      }
    }
  };

  return (
    <section className="discovery-bar" aria-label="Product Search and Filter Controls">
      {/* Sentinel for sticky detection */}
      <div ref={sentinelRef} className="discovery-bar__sentinel" />

      {/* Sticky Row Wrapper */}
      <div className={`discovery-bar__sticky-row-wrapper ${isSticky ? 'discovery-bar__sticky-row-wrapper--sticky' : ''}`}>
        <div className="discovery-bar__container">
          <div className="discovery-bar__search-sort-row">
            
            {/* Search Input Box */}
            <div ref={containerRef} className="discovery-bar__search-container">
              <Search className="discovery-bar__search-icon" size={18} aria-hidden="true" />
              <input
                id="discovery-search"
                type="search"
                className="discovery-bar__search-input"
                placeholder="Search for fashion, electronics and more..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
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

              {/* Suggestions / Recent Searches Dropdown */}
              {showSuggestions && (
                ((searchQuery.trim().length >= 3 && suggestions.length > 0) ||
                 (searchQuery.trim().length < 3 && recentSearches.length > 0)) && (
                  <div className="discovery-bar__suggestions-dropdown">
                    {searchQuery.trim().length >= 3 ? (
                      <ul className="discovery-bar__suggestions-list" role="listbox">
                        {suggestions.map((sug, idx) => (
                          <li
                            key={idx}
                            className={`discovery-bar__suggestion-item ${activeSuggestionIndex === idx ? 'discovery-bar__suggestion-item--active' : ''}`}
                            role="option"
                            aria-selected={activeSuggestionIndex === idx ? 'true' : 'false'}
                            onClick={() => handleSuggestionClick(sug)}
                          >
                            <Search size={14} aria-hidden="true" style={{ opacity: 0.5 }} />
                            <span>{sug}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <>
                        <div className="discovery-bar__suggestions-header">
                          <span>Recent Searches</span>
                          <button
                            type="button"
                            className="discovery-bar__clear-searches-btn"
                            onClick={handleClearRecent}
                          >
                            Clear
                          </button>
                        </div>
                        <ul className="discovery-bar__suggestions-list" role="listbox">
                          {recentSearches.map((sug, idx) => (
                            <li
                              key={idx}
                              className={`discovery-bar__suggestion-item ${activeSuggestionIndex === idx ? 'discovery-bar__suggestion-item--active' : ''}`}
                              role="option"
                              aria-selected={activeSuggestionIndex === idx ? 'true' : 'false'}
                              onClick={() => handleSuggestionClick(sug)}
                            >
                              <Search size={14} aria-hidden="true" style={{ opacity: 0.3 }} />
                              <span>{sug}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )
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

            {/* Mobile Sort Button */}
            {onOpenSort && (
              <button
                className="discovery-bar__mobile-sort-btn"
                onClick={onOpenSort}
                aria-label="Open sorting options"
                type="button"
              >
                <SlidersHorizontal size={18} aria-hidden="true" style={{ transform: 'rotate(90deg)' }} />
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
