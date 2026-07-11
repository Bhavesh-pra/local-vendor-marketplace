import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { Hero } from '../../components/home/Hero/index.jsx';
import { DiscoveryBar } from '../../components/home/DiscoveryBar/index.jsx';
import { ProductGrid } from '../../components/home/ProductGrid/index.jsx';
import { FilterSidebar } from '../../components/home/FilterSidebar/index.jsx';
import { PromoSection } from '../../components/home/PromoSection/index.jsx';
import { ActiveChips } from '../../components/home/ActiveChips/index.jsx';
import { MobileSortSheet } from '../../components/home/MobileSortSheet/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useCart } from '../../hooks/useCart.js';
import { useToast } from '../../hooks/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTelemetry } from '../../hooks/useTelemetry.js';
import { getProducts } from '../../services/productService.js';
import { getCarts, createCart, addCartItem } from '../../services/cartService.js';
import { extractErrorMessage } from '../../utils/extractErrorMessage.js';
import { CATEGORIES, ALL_CATEGORIES } from '../../constants/categories.js';
import './index.css';

const ALL_TAB = { ...ALL_CATEGORIES, id: 0 };
const CATEGORY_TABS = [ALL_TAB, ...CATEGORIES];
const DEBOUNCE_MS = 300;
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'sidebarCollapsed';

const SORT_OPTIONS = [
  { value: 'relevance',     label: 'Relevance' },
  { value: 'popularity',    label: 'Popularity' },
  { value: 'newest',        label: 'Newest' },
  { value: 'price_asc',     label: 'Price: Low to High' },
  { value: 'price_desc',    label: 'Price: High to Low' },
  { value: 'rating_desc',   label: 'Top Rated' },
  { value: 'discount_desc', label: 'Highest Discount' },
];

/**
 * Home page — orchestrates data fetching and state for all home components.
 */
export default function Home() {
  useDocumentTitle('Shop');

  const { isAuthenticated } = useAuth();
  const { cartId, setCartId, incrementCount } = useCart();
  const { showToast } = useToast();
  const { trackEvent } = useTelemetry();

  // Data state
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // URL driven discovery state
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const activeCategory = searchParams.get('category') || 'all';
  const sortOption = searchParams.get('sort') || 'relevance';
  const priceRange = searchParams.get('priceRange') || null;
  const minRating = searchParams.get('rating') ? parseInt(searchParams.get('rating'), 10) : null;
  const inStock = searchParams.get('stock') === 'true';
  const activeBrand = searchParams.get('brand') || '';

  // Brand facets from backend
  const [facets, setFacets] = useState({ brands: [] });

  // Search input state
  const [searchQuery, setSearchQuery] = useState(q);

  // Search quality states
  const [activeIntent, setActiveIntent] = useState(null);
  const [didYouMean, setDidYouMean] = useState(null);
  const [trending, setTrending] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Mobile drawer states
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);

  // Sync input value with URL param (handles browser back/forward)
  useEffect(() => {
    setSearchQuery(q);
  }, [q]);

  // Debounced URL sync for search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== q) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (searchQuery.trim()) {
            next.set('q', searchQuery.trim());
          } else {
            next.delete('q');
          }
          next.delete('page');
          return next;
        });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery, q, setSearchParams]);

  // URL setter wrappers with telemetry logging
  const setPriceRange = useCallback((val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set('priceRange', val);
        trackEvent('filter_applied', { metadata: { filter: 'priceRange', value: val } });
      } else {
        next.delete('priceRange');
        trackEvent('filter_cleared', { metadata: { filter: 'priceRange' } });
      }
      next.delete('page');
      return next;
    });
  }, [setSearchParams, trackEvent]);

  const setMinRating = useCallback((val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val != null) {
        next.set('rating', String(val));
        trackEvent('filter_applied', { metadata: { filter: 'rating', value: String(val) } });
      } else {
        next.delete('rating');
        trackEvent('filter_cleared', { metadata: { filter: 'rating' } });
      }
      next.delete('page');
      return next;
    });
  }, [setSearchParams, trackEvent]);

  const setInStock = useCallback((val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set('stock', 'true');
        trackEvent('filter_applied', { metadata: { filter: 'stock', value: 'true' } });
      } else {
        next.delete('stock');
        trackEvent('filter_cleared', { metadata: { filter: 'stock' } });
      }
      next.delete('page');
      return next;
    });
  }, [setSearchParams, trackEvent]);

  const setActiveCategory = useCallback((val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val && val !== 'all') {
        next.set('category', val);
        trackEvent('filter_applied', { metadata: { filter: 'category', value: val } });
      } else {
        next.delete('category');
        trackEvent('filter_cleared', { metadata: { filter: 'category' } });
      }
      next.delete('page');
      return next;
    });
  }, [setSearchParams, trackEvent]);

  const setBrand = useCallback((val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set('brand', val);
        trackEvent('filter_applied', { metadata: { filter: 'brand', value: val } });
      } else {
        next.delete('brand');
        trackEvent('filter_cleared', { metadata: { filter: 'brand' } });
      }
      next.delete('page');
      return next;
    });
  }, [setSearchParams, trackEvent]);

  const setSortOption = useCallback((val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set('sort', val);
        trackEvent('sort_changed', { metadata: { sort: val } });
      } else {
        next.delete('sort');
      }
      return next;
    });
  }, [setSearchParams, trackEvent]);

  const handleClearAll = useCallback(() => {
    // Keep search query q, clear other filters
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      const currentQ = prev.get('q');
      if (currentQ) {
        next.set('q', currentQ);
      }
      return next;
    });
    trackEvent('filter_cleared', { metadata: { clear_all: true } });
  }, [setSearchParams, trackEvent]);

  const [showFiltersSidebar, setShowFiltersSidebar] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    return stored === 'false' ? false : stored === 'true' ? true : false;
  });

  // Per-card loading state (keyed by product_id)
  const [addingProductId, setAddingProductId] = useState(null);

  // Persist desktop filter sidebar preference.
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(!showFiltersSidebar));
  }, [showFiltersSidebar]);

  // Ref to cancel in-flight Axios requests
  const abortControllerRef = useRef(null);

  // ── Fetch products ────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (paramsObj) => {
    setLoading(true);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const data = await getProducts(paramsObj, { signal: controller.signal });
      const productList = Array.isArray(data) ? data : (data.items ?? data.products ?? []);
      setProducts(productList);
      setTotalCount(data.total_count ?? productList.length);
      if (data && data.facets) {
        setFacets(data.facets);
      }
      setActiveIntent(data.intentOverride || null);
      setDidYouMean(data.didYouMean || null);
      setTrending(data.trending || []);

      // Telemetry: search_used (when query returns successfully)
      if (paramsObj.q) {
        trackEvent('search_used', {
          metadata: { query: paramsObj.q }
        });
      }

      // Telemetry: no_results_viewed
      if (paramsObj.q && productList.length === 0) {
        trackEvent('no_results_viewed', {
          metadata: {
            query: paramsObj.q,
            filters: {
              category: paramsObj.category,
              brand: paramsObj.brand,
              rating: paramsObj.rating,
              stock: paramsObj.stock
            }
          }
        });
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.message === 'canceled') {
        return;
      }
      setError(extractErrorMessage(err, 'Failed to load products.'));
      setActiveIntent(null);
      setDidYouMean(null);
      setTrending([]);
      setTotalCount(0);
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [trackEvent]);

  // Fetch when parameters change
  useEffect(() => {
    const paramsObj = {
      q,
      category: activeCategory,
      sort: sortOption,
      brand: activeBrand || undefined,
      minPrice: priceRange === 'under500' ? 0 : priceRange === '500-2000' ? 500 : priceRange === '2000-5000' ? 2000 : priceRange === '5000+' ? 5000 : undefined,
      maxPrice: priceRange === 'under500' ? 500 : priceRange === '500-2000' ? 2000 : priceRange === '2000-5000' ? 5000 : undefined,
      rating: minRating || undefined,
      stock: inStock ? 'true' : undefined
    };
    fetchProducts(paramsObj);
  }, [q, activeCategory, sortOption, activeBrand, priceRange, minRating, inStock, fetchProducts]);

  // ── Hydrate cart id for authenticated users ───────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || cartId) return;
    getCarts()
      .then((data) => {
        const carts = Array.isArray(data) ? data : data.carts ?? [];
        const active = carts.find((c) => c.status === 'active');
        if (active) setCartId(active.cart_id);
      })
      .catch(() => { /* non-critical */ });
  }, [isAuthenticated, cartId, setCartId]);

  // ── Scroll position memory tracking and restoration ─────────────────────
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    sessionStorage.removeItem('homeScrollPosition');
  }, [q, activeCategory, activeBrand, priceRange, minRating, inStock]);

  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('homeScrollPosition', window.scrollY.toString());
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!loading) {
      const savedScroll = sessionStorage.getItem('homeScrollPosition');
      if (savedScroll) {
        setTimeout(() => {
          window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'auto' });
        }, 50);
      }
    }
  }, [loading]);

  // ── Derived: active filters count ────────────────────────────────────────
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (priceRange) count++;
    if (minRating != null) count++;
    if (inStock) count++;
    if (activeBrand) count++;
    if (activeCategory && activeCategory !== 'all') count++;
    return count;
  }, [priceRange, minRating, inStock, activeBrand, activeCategory]);

  // Server-side filtered products list
  const filteredProducts = products;

  // ── Add to cart ───────────────────────────────────────────────────────────
  const handleAddToCart = useCallback(async (product) => {
    if (!isAuthenticated) {
      showToast('info', 'Please log in to add items to your cart.');
      return;
    }

    setAddingProductId(product.product_id);
    try {
      let activeCartId = cartId;
      if (!activeCartId) {
        const newCart = await createCart();
        activeCartId = newCart.cart_id ?? newCart.id;
        setCartId(activeCartId);
      }
      await addCartItem({ cart_id: activeCartId, product_id: product.product_id, quantity: 1 });
      incrementCount(1);
      showToast('success', `${product.product_name} added to cart!`);

      // Telemetry: add_to_cart
      trackEvent('add_to_cart', {
        productId: product.product_id,
        categoryId: product.category_id,
        metadata: { quantity: 1 }
      });
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to add item to cart.'));
    } finally {
      setAddingProductId(null);
    }
  }, [isAuthenticated, cartId, setCartId, incrementCount, showToast, trackEvent]);

  // Derived empty states helpers
  const hasActiveFilters = useMemo(() => {
    return !!(priceRange || minRating || inStock || activeBrand || (activeCategory && activeCategory !== 'all'));
  }, [priceRange, minRating, inStock, activeBrand, activeCategory]);

  const hasActiveSearch = useMemo(() => {
    return !!q.trim();
  }, [q]);

  // ── Derived: show Hero only when no active search/filter ─────────────────
  const showHero = !searchQuery && activeCategory === 'all' && !priceRange && !minRating && !inStock && !activeBrand;

  return (
    <PageLayout>
      {/* Hero is full-bleed — hidden when any filter/search is active */}
      <Hero isVisible={showHero} />

      <DiscoveryBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        categories={CATEGORY_TABS}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        resultCount={loading ? null : filteredProducts.length}
        isFiltersOpen={showFiltersSidebar}
        activeFiltersCount={activeFiltersCount}
        onToggleFilters={() => {
          if (window.innerWidth <= 992) {
            setMobileFiltersOpen(true);
          } else {
            setShowFiltersSidebar((prev) => !prev);
          }
        }}
        onOpenSort={() => setMobileSortOpen(true)}
      />

      <div className="container">
        <div className={`home-layout ${showFiltersSidebar ? 'home-layout--with-sidebar' : ''}`}>
          {/* Filter Sidebar */}
          <FilterSidebar
            desktopVisible={showFiltersSidebar}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
            minRating={minRating}
            onRatingChange={setMinRating}
            inStock={inStock}
            onInStockChange={setInStock}
            onClearAll={handleClearAll}
            isOpen={mobileFiltersOpen}
            onClose={() => setMobileFiltersOpen(false)}
            
            categories={CATEGORY_TABS.filter(c => c.slug !== 'all')}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            brands={facets.brands}
            activeBrand={activeBrand}
            onBrandChange={setBrand}
            loadingFacets={loading}
          />

          {/* Main content area */}
          <div className="home-layout__main">
            {/* Sort bar above grid */}
            <div className="home-sort-bar">
              {!loading && (
                <p className="home-sort-bar__count" aria-live="polite">
                  {totalCount} product{totalCount !== 1 ? 's' : ''}
                </p>
              )}
              
              {/* Desktop Sort Wrapper */}
              <div className="home-sort-bar__select-wrap">
                <label htmlFor="home-sort-select" className="home-sort-bar__label">Sort:</label>
                <select
                  id="home-sort-select"
                  className="home-sort-bar__select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Mobile Sort Button (>= 44px target) */}
              <button
                type="button"
                className="home-sort-bar__mobile-btn"
                onClick={() => setMobileSortOpen(true)}
              >
                Sort By: {SORT_OPTIONS.find(o => o.value === sortOption)?.label || 'Relevance'}
              </button>
            </div>

            {/* Active Chips Row */}
            <ActiveChips />

            {/* Search Intent Notification Banner */}
            {activeIntent && (
              <div className="search-intent-banner">
                <svg className="search-intent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  {activeIntent.sortApplied === 'price_asc' && "Sorted by Price: Low to High based on your search."}
                  {activeIntent.sortApplied === 'rating_desc' && "Sorted by Rating: High to Low based on your search."}
                  {activeIntent.sortApplied === 'popularity' && "Sorted by Popularity based on your search."}
                </span>
              </div>
            )}

            <ProductGrid
              products={filteredProducts}
              loading={loading}
              error={error}
              onRetry={fetchProducts}
              onAddToCart={handleAddToCart}
              addingProductId={addingProductId}
              onClearFilters={handleClearAll}
              activeCategory={activeCategory}
              hasActiveFilters={hasActiveFilters}
              hasActiveSearch={hasActiveSearch}
              didYouMean={didYouMean}
              trending={trending}
              onSearch={setSearchQuery}
            />
          </div>
        </div>
      </div>

      <MobileSortSheet
        isOpen={mobileSortOpen}
        onClose={() => setMobileSortOpen(false)}
      />

      <PromoSection />
    </PageLayout>
  );
}
