import { useEffect, useState, useMemo } from 'react';
import { getRecommendations } from '../../../services/recommendationService.js';
import { ProductCard } from '../ProductCard/index.jsx';
import { useTelemetry } from '../../../hooks/useTelemetry.js';
import { useCart } from '../../../hooks/useCart.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { useToast } from '../../../hooks/useToast.js';
import { createCart, addCartItem } from '../../../services/cartService.js';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

const ENGINE_TITLES = {
  frequently_bought_together: 'Frequently Bought Together',
  customers_also_viewed: 'Customers Also Viewed',
  similar_products: 'Similar Products',
  trending_products: 'Trending Products',
  recently_viewed: 'Recently Viewed',
};

export function RecommendationRails({ productId }) {
  const { trackEvent } = useTelemetry();
  const { isAuthenticated } = useAuth();
  const { cartId, setCartId, incrementCount } = useCart();
  const { showToast } = useToast();

  const [candidates, setCandidates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingProductId, setAddingProductId] = useState(null);

  // Fetch candidate rails from backend
  useEffect(() => {
    let active = true;
    setLoading(true);

    getRecommendations(productId)
      .then((data) => {
        if (active) {
          setCandidates(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('[RecommendationRails] Failed to load recommendations:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId]);

  // Handle Add to Cart from recommendation cards
  const handleAddToCart = async (product) => {
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
  };

  // Dynamic rail generation with cross-rail deduplication
  const railsToRender = useMemo(() => {
    if (!candidates) return [];

    const {
      frequently_bought_together = [],
      customers_also_viewed = [],
      similar_products = [],
      trending_products = []
    } = candidates;

    // Read recently viewed from client storage
    let recentlyViewedRaw = [];
    try {
      recentlyViewedRaw = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    } catch (_) {}

    const resultRails = [];
    const excludeSet = new Set([parseInt(productId, 10)]);

    // ─── 1. Primary Recommendation Rail ───
    let selectedEngine1 = '';
    let pool1 = [];

    if (frequently_bought_together.length >= 3) {
      selectedEngine1 = 'frequently_bought_together';
      pool1 = frequently_bought_together;
    } else if (similar_products.length >= 4) {
      selectedEngine1 = 'similar_products';
      pool1 = similar_products;
    } else {
      selectedEngine1 = 'trending_products';
      pool1 = trending_products;
    }

    // Filter deduplicated visible items for Rail 1
    const items1 = pool1.filter(p => !excludeSet.has(p.product_id));
    if (items1.length >= 2) {
      const selectedItems = items1.slice(0, 4);
      selectedItems.forEach(p => excludeSet.add(p.product_id));
      resultRails.push({
        source: selectedEngine1,
        title: ENGINE_TITLES[selectedEngine1],
        items: selectedItems
      });
    }

    // ─── 2. Secondary Recommendation Rail ───
    let selectedEngine2 = '';
    let pool2 = [];

    if (customers_also_viewed.length >= 5) {
      selectedEngine2 = 'customers_also_viewed';
      pool2 = customers_also_viewed;
    } else {
      selectedEngine2 = 'trending_products';
      pool2 = trending_products;
    }

    // Filter deduplicated visible items for Rail 2
    const items2 = pool2.filter(p => !excludeSet.has(p.product_id));
    if (items2.length >= 2) {
      const selectedItems = items2.slice(0, 4);
      selectedItems.forEach(p => excludeSet.add(p.product_id));
      resultRails.push({
        source: selectedEngine2,
        title: ENGINE_TITLES[selectedEngine2],
        items: selectedItems
      });
    }

    // ─── 3. Recently Viewed Rail (Optional) ───
    const items3 = recentlyViewedRaw.filter(p => !excludeSet.has(p.product_id));
    if (items3.length >= 2) {
      const selectedItems = items3.slice(0, 4);
      resultRails.push({
        source: 'recently_viewed',
        title: ENGINE_TITLES.recently_viewed,
        items: selectedItems
      });
    }

    return resultRails;
  }, [candidates, productId]);

  if (loading) {
    return (
      <div className="recommendation-rails recommendation-rails--loading">
        {Array.from({ length: 2 }).map((_, rIdx) => (
          <div key={rIdx} className="recommendation-rails__section">
            <div className="recommendation-rails__shimmer-title" />
            <div className="recommendation-rails__grid">
              {Array.from({ length: 4 }).map((_, cIdx) => (
                <div key={cIdx} className="recommendation-rails__shimmer-card" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (railsToRender.length === 0) {
    return null;
  }

  return (
    <div className="recommendation-rails">
      {railsToRender.map((rail, rIdx) => (
        <section key={rIdx} className="recommendation-rails__section" aria-label={rail.title}>
          <h2 className="recommendation-rails__title">{rail.title}</h2>
          <div className="recommendation-rails__grid">
            {rail.items.map((prod) => (
              <ProductCard
                key={prod.product_id}
                product={prod}
                onAddToCart={() => handleAddToCart(prod)}
                isAdding={addingProductId === prod.product_id}
                onClick={() => {
                  trackEvent('recommendation_click', {
                    productId: prod.product_id,
                    metadata: {
                      source: rail.source,
                      product_id: prod.product_id
                    }
                  });
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
