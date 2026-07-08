import React, { useState, useEffect } from 'react';
import { ProductCard } from '../home/ProductCard/index.jsx';
import './RecentlyViewed.css';

export default function RecentlyViewed({ currentProductId }) {
  const [list, setList] = useState([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    // Filter out the current product being viewed
    const filtered = stored.filter(p => String(p.product_id) !== String(currentProductId));
    setList(filtered);
  }, [currentProductId]);

  if (list.length === 0) return null;

  return (
    <div className="recently-viewed-section">
      <h3 className="recently-viewed-title">Recently Viewed Products</h3>
      <div className="recently-viewed-grid">
        {list.map((prod) => (
          <ProductCard
            key={prod.product_id}
            product={prod}
            onAddToCart={() => {}} // Add to cart placeholder or direct link click
          />
        ))}
      </div>
    </div>
  );
}
