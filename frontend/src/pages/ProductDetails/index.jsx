import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { ReviewsSection } from './components/ReviewsSection/index.jsx';
import { ReviewForm } from './components/ReviewForm/index.jsx';
import { ErrorState } from '../../components/ui/ErrorState/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useCart } from '../../hooks/useCart.js';
import { useToast } from '../../hooks/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { getProduct } from '../../services/productService.js';
import { getReviews } from '../../services/reviewService.js';
import { createCart, addCartItem } from '../../services/cartService.js';
import { ROUTES } from '../../constants/routes.js';
import { extractErrorMessage } from '../../utils/extractErrorMessage.js';
import { useTelemetry } from '../../hooks/useTelemetry.js';

// New Experience Components
import Breadcrumbs from '../../components/Product/Breadcrumbs.jsx';
import HighlightsSection from '../../components/Product/HighlightsSection.jsx';
import RatingSummary from '../../components/Product/RatingSummary.jsx';
import VariantSelector from '../../components/Product/VariantSelector.jsx';
import BuyBox from '../../components/Product/BuyBox.jsx';
import TrustBadges from '../../components/Product/TrustBadges.jsx';
import ProductTabs from '../../components/Product/ProductTabs.jsx';
import { RecommendationRails } from '../../components/home/RecommendationRails/index.jsx';
import ShareButton from '../../components/Product/ShareButton.jsx';
import StickyPurchaseBar from '../../components/Product/StickyPurchaseBar.jsx';
import ProductGallery from '../../components/Product/ProductGallery.jsx';

import './index.css';

/**
 * ProductDetails Page — displays the product details, reviews, and related products recommendations.
 */
export default function ProductDetails() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const { cartId, setCartId, incrementCount } = useCart();
  const { showToast } = useToast();
  const { trackEvent } = useTelemetry();

  // Data states
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const [reviewsHasNext, setReviewsHasNext] = useState(false);
  const [reviewsTotalCount, setReviewsTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addingRelatedProductId, setAddingRelatedProductId] = useState(null);

  // Variant & Purchasing states
  const [selectedColor, setSelectedColor] = useState('Default');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);

  useDocumentTitle(product ? product.product_name : 'Loading Product...');

  // Fetch product and reviews in parallel
  const fetchData = useCallback(async () => {
    setLoading(true);
    setReviewsLoading(true);
    setError(null);
    try {
      const [productData, reviewsResponse] = await Promise.all([
        getProduct(productId),
        getReviews(productId, { page: 1, limit: 3 })
      ]);
      
      setProduct(productData);
      setReviews(reviewsResponse?.reviews || []);
      setVisibleCount(3);
      setReviewsHasNext(reviewsResponse?.has_next || false);
      setReviewsTotalCount(reviewsResponse?.total_count || 0);

      // Auto-select first/default variant parameters
      const defaultVar = productData.variants?.find(v => v.is_default === 1) || productData.variants?.[0];
      if (defaultVar) {
        setSelectedColor(defaultVar.color || 'Default');
        setSelectedSize(defaultVar.size || '');
      }
      setQuantity(1);

    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load product details.'));
    } finally {
      setLoading(false);
      setReviewsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Log visited product for recently viewed tracking
  useEffect(() => {
    if (product) {
      const stored = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      const filtered = stored.filter(p => p.product_id !== product.product_id);
      filtered.unshift({
        product_id: product.product_id,
        product_name: product.product_name,
        category: product.category_name || product.category || 'Product',
        selling_price: product.selling_price,
        mrp: product.mrp || product.selling_price,
        image_url: product.image_url,
        average_rating: product.average_rating || 0,
        badge: product.badge || null,
        product_status: product.product_status
      });
      // Limit to 10 items
      localStorage.setItem('recentlyViewed', JSON.stringify(filtered.slice(0, 10)));

      // Telemetry product view
      trackEvent('product_view', {
        productId: product.product_id,
        categoryId: product.category_id
      });
    }
  }, [product, trackEvent]);

  const refreshReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const data = await getReviews(productId, { page: 1, limit: 3 });
      setReviews(data?.reviews || []);
      setVisibleCount(3);
      setReviewsHasNext(data?.has_next || false);
      setReviewsTotalCount(data?.total_count || 0);
    } catch (err) {
      console.error('Failed to reload reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  }, [productId]);

  const loadMoreReviews = useCallback(async () => {
    if (visibleCount < reviews.length) {
      setVisibleCount(prev => Math.min(prev + 10, reviews.length));
      return;
    }

    const calcPage = Math.floor((reviews.length - 3) / 10) + 2;

    try {
      const data = await getReviews(productId, { page: calcPage, limit: 10 });
      const newReviews = data.reviews || [];
      setReviews(prev => [...prev, ...newReviews]);
      setVisibleCount(prev => prev + newReviews.length);
      setReviewsHasNext(data.has_next || false);
      setReviewsTotalCount(data.total_count || 0);
    } catch (err) {
      console.error('Failed to load more reviews:', err);
    }
  }, [productId, reviews.length, visibleCount]);

  const showLessReviews = useCallback(() => {
    setVisibleCount(3);
  }, []);

  // Get active selected variant
  const activeVariant = product?.variants?.find(
    v => (v.color || 'Default') === selectedColor && (selectedSize ? v.size === selectedSize : true)
  ) || product?.variants?.[0];

  // Add to cart handler
  const handleAddToCart = useCallback(async (qty) => {
    if (!isAuthenticated) {
      showToast('info', 'Please log in to add items to your cart.');
      return;
    }
    if (!product) return;

    setIsAdding(true);
    try {
      let activeCartId = cartId;
      if (!activeCartId) {
        const newCart = await createCart();
        activeCartId = newCart.cart_id ?? newCart.id;
        setCartId(activeCartId);
      }

      // Add to cart with variant override if active
      const payload = {
        cart_id: activeCartId,
        product_id: product.product_id,
        quantity: qty,
        variant_id: activeVariant?.variant_id || null
      };

      await addCartItem(payload);
      incrementCount(qty);
      showToast('success', `${qty} × ${product.product_name} added to cart!`);
      trackEvent('add_to_cart', {
        productId: product.product_id,
        categoryId: product.category_id,
        metadata: { quantity: qty }
      });
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to add item to cart.'));
    } finally {
      setIsAdding(false);
    }
  }, [isAuthenticated, product, activeVariant, cartId, setCartId, incrementCount, showToast]);

  // Buy Now handler
  const handleBuyNow = useCallback(async (qty) => {
    if (!isAuthenticated) {
      showToast('info', 'Please log in to make a purchase.');
      return;
    }
    if (!product) return;

    setIsAdding(true);
    try {
      let activeCartId = cartId;
      if (!activeCartId) {
        const newCart = await createCart();
        activeCartId = newCart.cart_id ?? newCart.id;
        setCartId(activeCartId);
      }

      const payload = {
        cart_id: activeCartId,
        product_id: product.product_id,
        quantity: qty,
        variant_id: activeVariant?.variant_id || null
      };

      await addCartItem(payload);
      incrementCount(qty);
      showToast('success', `Proceeding to checkout with ${qty} × ${product.product_name}.`);
      navigate(ROUTES.CHECKOUT);
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to add item to cart.'));
    } finally {
      setIsAdding(false);
    }
  }, [isAuthenticated, product, activeVariant, cartId, setCartId, incrementCount, showToast, navigate]);

  // Add related products card to cart
  const handleRelatedAddToCart = useCallback(async (relatedProd) => {
    if (!isAuthenticated) {
      showToast('info', 'Please log in to add items to your cart.');
      return;
    }
    setAddingRelatedProductId(relatedProd.product_id);
    try {
      let activeCartId = cartId;
      if (!activeCartId) {
        const newCart = await createCart();
        activeCartId = newCart.cart_id ?? newCart.id;
        setCartId(activeCartId);
      }

      await addCartItem({
        cart_id: activeCartId,
        product_id: relatedProd.product_id,
        quantity: 1,
        variant_id: null
      });
      incrementCount(1);
      showToast('success', `${relatedProd.product_name} added to cart!`);
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to add item to cart.'));
    } finally {
      setAddingRelatedProductId(null);
    }
  }, [isAuthenticated, cartId, setCartId, incrementCount, showToast]);

  if (error) {
    return (
      <PageLayout>
        <div className="product-details-page__error container">
          <ErrorState message={error} onRetry={fetchData} />
        </div>
      </PageLayout>
    );
  }

  if (loading || !product) {
    return (
      <PageLayout>
        <div className="product-details-loading container">
          <div className="loading-spinner"></div>
          <p>Loading premium experience...</p>
        </div>
      </PageLayout>
    );
  }

  const canReview = isAuthenticated && role === 'customer';
  const selectedVariantDesc = activeVariant
    ? `${activeVariant.color !== 'Default' ? `Color: ${activeVariant.color}` : ''} ${activeVariant.size ? `(Size: ${activeVariant.size})` : ''}`.trim()
    : '';

  return (
    <PageLayout>
      <div className="product-details-page container">
        {/* Hierarchical Breadcrumb Navigation */}
        <Breadcrumbs category={product.category_name || product.category} productName={product.product_name} />

        {/* Two-Column Details Layout */}
        <div className="product-details-grid">
          {/* Left Column: Gallery Section */}
          <div className="product-details-col-left">
            <ProductGallery media={product.media} badge={product.badge} />
          </div>

          {/* Right Column: Information & Buy Box */}
          <div className="product-details-col-right">
            <div className="product-meta-header">
              <span className="product-brand-tag">{product.brand || 'ShopCart Exclusive'}</span>
              <h1 className="product-title-text">{product.product_name}</h1>
              
              {/* Star Rating Widget + Share inline */}
              <div className="meta-rating-share">
                <RatingSummary rating={product.average_rating} reviewsCount={product.reviews_count} />
                <ShareButton />
              </div>
              
              {/* Product Short Description */}
              {product.short_description && (
                <p className="product-short-desc">{product.short_description}</p>
              )}
            </div>

            {/* Highlights List */}
            <HighlightsSection specifications={product.specifications} />

            {/* Dynamic Variant Selector */}
            <VariantSelector
              variants={product.variants}
              selectedColor={selectedColor}
              selectedSize={selectedSize}
              onSelectColor={setSelectedColor}
              onSelectSize={setSelectedSize}
            />

            {/* Sticky/Conversion Buy Box */}
            <BuyBox
              product={product}
              selectedVariant={activeVariant}
              quantity={quantity}
              onQuantityChange={setQuantity}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
              isAdding={isAdding}
              shipping={product.shipping}
              warranty={product.warranty}
              onAddToWishlist={() => trackEvent('wishlist_add', { productId: product.product_id })}
            />
          </div>
        </div>

        {/* Bottom Section: Badges and Detailed Tabs */}
        <div className="product-details-bottom">
          <TrustBadges product={product} />

          <ProductTabs
            description={product.description}
            specifications={product.specifications}
            warranty={product.warranty}
            shipping={product.shipping}
          />
        </div>

        {/* Reviews Section */}
        <div className="product-details-page__reviews">
          <ReviewsSection
            reviews={reviews}
            loading={reviewsLoading}
            visibleCount={visibleCount}
            hasNext={visibleCount < reviews.length || reviewsHasNext}
            totalCount={reviewsTotalCount}
            onLoadMore={loadMoreReviews}
            onShowLess={showLessReviews}
          />

          {/* Review submission form */}
          {canReview && !loading && (
            <ReviewForm productId={productId} onSubmitSuccess={refreshReviews} />
          )}
        </div>

        {/* Dynamic Recommendations Rails */}
        <RecommendationRails productId={product.product_id} />

        {/* Mobile Sticky Bottom Purchase Panel */}
        <StickyPurchaseBar
          productName={product.product_name}
          price={activeVariant ? activeVariant.selling_price : product.selling_price}
          selectedVariantDesc={selectedVariantDesc}
          isOutOfStock={activeVariant ? activeVariant.available_stock <= 0 : false}
          onAddToCart={() => handleAddToCart(quantity)}
          onBuyNow={() => handleBuyNow(quantity)}
          loading={isAdding}
        />
      </div>
    </PageLayout>
  );
}
