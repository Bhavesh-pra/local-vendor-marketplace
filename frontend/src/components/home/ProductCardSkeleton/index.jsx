import { Skeleton } from '../../ui/Skeleton/index.jsx';
import './index.css';

/**
 * ProductCardSkeleton — loading placeholder pixel-identical to the new ProductCard layout.
 * Order: image → rating row → name (2 lines) → price row → button
 */
export function ProductCardSkeleton() {
  return (
    <div className="product-card-skeleton" aria-hidden="true">
      {/* Image — 1:1 ratio */}
      <div className="product-card-skeleton__image-wrap">
        <Skeleton width="100%" height="100%" borderRadius="0" />
      </div>

      {/* Body */}
      <div className="product-card-skeleton__body">
        {/* 1. Title */}
        <Skeleton width="80%" height="13px" borderRadius="var(--radius-sm)" />

        {/* 2. Badges */}
        <div style={{ display: 'flex', gap: '4px', marginBlock: '2px' }}>
          <Skeleton width="40px" height="14px" borderRadius="var(--radius-sm)" />
          <Skeleton width="60px" height="14px" borderRadius="var(--radius-sm)" />
        </div>

        {/* 3. Description */}
        <Skeleton width="92%" height="10px" borderRadius="var(--radius-sm)" />
        <Skeleton width="70%" height="10px" borderRadius="var(--radius-sm)" style={{ marginTop: '2px' }} />

        {/* 4. Footer Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '4px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <Skeleton width="30px" height="8px" borderRadius="var(--radius-sm)" />
            <Skeleton width="60px" height="14px" borderRadius="var(--radius-sm)" />
          </div>
          <Skeleton width="80px" height="32px" borderRadius="8px" />
        </div>
      </div>
    </div>
  );
}
