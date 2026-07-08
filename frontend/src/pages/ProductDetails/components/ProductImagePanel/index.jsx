import { ImageWithFallback } from '../../../../components/ui/ImageWithFallback/index.jsx';
import { Skeleton } from '../../../../components/ui/Skeleton/index.jsx';
import './index.css';

/**
 * ProductImagePanel — displays the product image with aspect-ratio container
 * and contain object-fit, centered vertically.
 *
 * @param {string}   src
 * @param {string}   alt
 * @param {boolean}  loading
 */
export function ProductImagePanel({ src, alt, loading }) {
  if (loading) {
    return (
      <div className="product-image-panel-container">
        <div className="product-image-panel product-image-panel--loading">
          <Skeleton width="100%" height="100%" borderRadius="var(--radius-xl)" />
        </div>
      </div>
    );
  }

  return (
    <div className="product-image-panel-container">
      <div className="product-image-panel">
        <div className="product-image-panel__wrap">
          <ImageWithFallback
            src={src}
            alt={alt || 'Product Image'}
            className="product-image-panel__img"
            eager={true}
          />
        </div>
      </div>
    </div>
  );
}
