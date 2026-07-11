import './ProductGridSkeleton.css';

export function ProductGridSkeleton() {
  const cards = Array.from({ length: 8 });

  return (
    <div className="product-grid-skeleton" aria-hidden="true">
      {cards.map((_, idx) => {
        const isDesktopOnly = idx >= 6;
        return (
          <div
            key={idx}
            className={`product-grid-skeleton__card ${isDesktopOnly ? 'product-grid-skeleton__card--desktop-only' : ''}`}
          >
            {/* Image Placeholder */}
            <div className="product-grid-skeleton__image shimmer" />

            {/* Info Container */}
            <div className="product-grid-skeleton__info">
              {/* Brand/Badge */}
              <div className="product-grid-skeleton__line product-grid-skeleton__brand shimmer" />
              
              {/* Title */}
              <div className="product-grid-skeleton__line product-grid-skeleton__title shimmer" />
              <div className="product-grid-skeleton__line product-grid-skeleton__title-sub shimmer" />

              {/* Rating */}
              <div className="product-grid-skeleton__line product-grid-skeleton__rating shimmer" />

              {/* Price Row */}
              <div className="product-grid-skeleton__price-row">
                <div className="product-grid-skeleton__line product-grid-skeleton__price shimmer" />
                <div className="product-grid-skeleton__button shimmer" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
