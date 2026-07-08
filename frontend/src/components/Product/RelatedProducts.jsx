import React from 'react';
import { ProductCard } from '../home/ProductCard/index.jsx';
import './RelatedProducts.css';

export default function RelatedProducts({ relatedProducts, onAddToCart, isAddingProductId }) {
  if (!relatedProducts) return null;

  const { similar = [], brand = [], frequentlyBought = [] } = relatedProducts;

  const hasSimilar = similar.length > 0;
  const hasBrand = brand.length > 0;
  const hasFreq = frequentlyBought.length > 0;

  if (!hasSimilar && !hasBrand && !hasFreq) return null;

  return (
    <div className="related-products-section">
      {hasFreq && (
        <div className="related-group fade-in">
          <h3 className="related-group-title">Frequently Bought Together</h3>
          <div className="related-grid">
            {frequentlyBought.map((prod) => (
              <ProductCard
                key={prod.product_id}
                product={prod}
                onAddToCart={() => onAddToCart(prod)}
                isAdding={isAddingProductId === prod.product_id}
              />
            ))}
          </div>
        </div>
      )}

      {hasSimilar && (
        <div className="related-group fade-in">
          <h3 className="related-group-title">Similar Products</h3>
          <div className="related-grid">
            {similar.map((prod) => (
              <ProductCard
                key={prod.product_id}
                product={prod}
                onAddToCart={() => onAddToCart(prod)}
                isAdding={isAddingProductId === prod.product_id}
              />
            ))}
          </div>
        </div>
      )}

      {hasBrand && (
        <div className="related-group fade-in">
          <h3 className="related-group-title">More From Brand</h3>
          <div className="related-grid">
            {brand.map((prod) => (
              <ProductCard
                key={prod.product_id}
                product={prod}
                onAddToCart={() => onAddToCart(prod)}
                isAdding={isAddingProductId === prod.product_id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
