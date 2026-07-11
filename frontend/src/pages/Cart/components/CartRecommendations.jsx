import React, { useState, useEffect } from 'react';
import { ProductCard } from '../../../components/home/ProductCard/index.jsx';
import { getProducts } from '../../../services/productService.js';
import './CartRecommendations.css';

export function CartRecommendations({ cartItems, onAddToCart, isAddingProductId }) {
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecommendations() {
      try {
        const catalog = await getProducts();
        const allProducts = Array.isArray(catalog) ? catalog : (catalog?.items ?? catalog?.products ?? []);

        // 1. Get IDs of products already in cart to exclude
        const cartProductIds = new Set(cartItems.map(item => item.product_id));

        // 2. Load recently viewed from localStorage
        const localRecentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
        
        // Filter recently viewed: must be active in catalog, and not already in cart
        const filteredRecent = localRecentlyViewed
          .map(rv => allProducts.find(p => p.product_id === rv.product_id))
          .filter(p => p && p.product_status === 'active' && !cartProductIds.has(p.product_id));

        // 3. Find same-category products
        // Extract active categories in cart
        const activeCategories = new Set(cartItems.map(item => item.category_id).filter(Boolean));
        // If cart is empty, extract categories from recently viewed
        if (activeCategories.size === 0) {
          filteredRecent.forEach(p => {
            if (p.category_id) activeCategories.add(p.category_id);
          });
        }

        const sameCategory = allProducts.filter(p => 
          p.product_status === 'active' &&
          p.category_id && 
          activeCategories.has(p.category_id) && 
          !cartProductIds.has(p.product_id) &&
          !filteredRecent.some(r => r.product_id === p.product_id)
        );

        // 4. Fallback (any other active products)
        const fallbacks = allProducts.filter(p => 
          p.product_status === 'active' &&
          !cartProductIds.has(p.product_id) &&
          !filteredRecent.some(r => r.product_id === p.product_id) &&
          !sameCategory.some(s => s.product_id === p.product_id)
        );

        // Merge them in priority order and limit to 4
        const merged = [...filteredRecent, ...sameCategory, ...fallbacks].slice(0, 4);
        setRecommended(merged);
      } catch (err) {
        console.error('Failed to load recommendations', err);
      } finally {
        setLoading(false);
      }
    }

    loadRecommendations();
  }, [cartItems]);

  if (loading || recommended.length === 0) return null;

  return (
    <div className="cart-recommendations">
      <h2 className="cart-recommendations__title">Recommended for You</h2>
      <div className="cart-recommendations__grid">
        {recommended.map((product) => (
          <ProductCard
            key={product.product_id}
            product={product}
            onAddToCart={onAddToCart}
            isAdding={isAddingProductId === product.product_id}
          />
        ))}
      </div>
    </div>
  );
}
