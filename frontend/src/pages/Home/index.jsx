import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { Hero } from '../../components/home/Hero/index.jsx';
import { DiscoveryBar } from '../../components/home/DiscoveryBar/index.jsx';
import { ProductGrid } from '../../components/home/ProductGrid/index.jsx';
import { FilterSidebar } from '../../components/home/FilterSidebar/index.jsx';
import { PromoSection } from '../../components/home/PromoSection/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useCart } from '../../hooks/useCart.js';
import { useToast } from '../../hooks/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { getProducts } from '../../services/productService.js';
import { getCarts, createCart, addCartItem } from '../../services/cartService.js';
import { filterProducts } from '../../utils/search.js';
import { extractErrorMessage } from '../../utils/extractErrorMessage.js';
import { CATEGORIES, ALL_CATEGORIES } from '../../constants/categories.js';
import './index.css';

const ALL_TAB = { ...ALL_CATEGORIES, id: 0 };
const CATEGORY_TABS = [ALL_TAB, ...CATEGORIES];
const DEBOUNCE_MS = 300;
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'sidebarCollapsed';

const SORT_OPTIONS = [
  { value: 'default',       label: 'Featured' },
  { value: 'newest',        label: 'Newest' },
  { value: 'price-asc',     label: 'Price: Low to High' },
  { value: 'price-desc',    label: 'Price: High to Low' },
  { value: 'rating-desc',   label: 'Top Rated' },
  { value: 'discount-desc', label: 'Highest Discount' },
];

/**
 * Home page — orchestrates data fetching and state for all home components.
 */
export default function Home() {
  useDocumentTitle('Shop');

  const { isAuthenticated } = useAuth();
  const { cartId, setCartId, incrementCount } = useCart();
  const { showToast } = useToast();

  // Data state
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortOption, setSortOption] = useState('default');
  const [showFiltersSidebar, setShowFiltersSidebar] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    return stored === 'false' ? false : stored === 'true' ? true : false;
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [priceRange, setPriceRange] = useState(null);
  const [minRating, setMinRating] = useState(null);
  const [inStock, setInStock] = useState(false);

  // Per-card loading state (keyed by product_id)
  const [addingProductId, setAddingProductId] = useState(null);

  // Persist desktop filter sidebar preference.
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(!showFiltersSidebar));
  }, [showFiltersSidebar]);

  // ── Fetch products ────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProducts();
      setProducts(Array.isArray(data) ? data : data.products ?? []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load products.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

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

  // ── Search debounce ───────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Scroll position memory tracking and restoration ─────────────────────
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    sessionStorage.removeItem('homeScrollPosition');
  }, [searchQuery, activeCategory, priceRange, minRating, inStock]);

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
    return count;
  }, [priceRange, minRating, inStock]);

  // ── Derived: filtered + sorted products ──────────────────────────────────
  const filteredProducts = useMemo(() => {
    let result = filterProducts(products, debouncedQuery, activeCategory, sortOption);

    // Price range filter
    if (priceRange === 'under500') {
      result = result.filter((p) => p.selling_price < 500);
    } else if (priceRange === '500-2000') {
      result = result.filter((p) => p.selling_price >= 500 && p.selling_price <= 2000);
    } else if (priceRange === '2000-5000') {
      result = result.filter((p) => p.selling_price >= 2000 && p.selling_price <= 5000);
    } else if (priceRange === '5000+') {
      result = result.filter((p) => p.selling_price >= 5000);
    }

    // Rating filter
    if (minRating != null) {
      result = result.filter((p) => (p.average_rating ?? 0) >= minRating);
    }

    // In-stock filter
    if (inStock) {
      result = result.filter((p) => p.product_status === 'active');
    }

    return result;
  }, [products, debouncedQuery, activeCategory, sortOption, priceRange, minRating, inStock]);

  // ── Clear all filters ─────────────────────────────────────────────────────
  const handleClearAll = useCallback(() => {
    setPriceRange(null);
    setMinRating(null);
    setInStock(false);
    setSortOption('default');
    setActiveCategory('all');
    setSearchQuery('');
  }, []);

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
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to add item to cart.'));
    } finally {
      setAddingProductId(null);
    }
  }, [isAuthenticated, cartId, setCartId, incrementCount, showToast]);

  // ── Derived: show Hero only when no active search/filter ─────────────────
  const showHero = !searchQuery && activeCategory === 'all' && !priceRange && !minRating && !inStock;

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
          // Desktop: toggle sidebar column; mobile: open drawer
          if (window.innerWidth <= 992) {
            setMobileFiltersOpen(true);
          } else {
            setShowFiltersSidebar((prev) => !prev);
          }
        }}
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
          />

          {/* Main content area */}
          <div className="home-layout__main">
            {/* Sort bar above grid */}
            <div className="home-sort-bar">
              {!loading && (
                <p className="home-sort-bar__count" aria-live="polite">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                </p>
              )}
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
            </div>

            <ProductGrid
              products={filteredProducts}
              loading={loading}
              error={error}
              onRetry={fetchProducts}
              onAddToCart={handleAddToCart}
              addingProductId={addingProductId}
              onClearFilters={handleClearAll}
            />
          </div>
        </div>
      </div>

      <PromoSection />
    </PageLayout>
  );
}
