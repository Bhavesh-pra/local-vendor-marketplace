import React, { useState, useRef } from 'react';
import ImageViewerModal from './ImageViewerModal.jsx';
import './ProductGallery.css';

export default function ProductGallery({ media, badge }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Touch swipe state
  const touchStartX = useRef(null);

  // Consolidate cover, video, and gallery into a flat array of assets
  const assets = [];
  if (media?.cover) {
    assets.push({ type: 'image', url: media.cover, alt: media.coverAlt || 'Cover image' });
  }
  if (media?.video) {
    assets.push({ type: 'video', url: media.video, alt: media.videoAlt || 'Product video' });
  }
  if (media?.gallery && Array.isArray(media.gallery)) {
    media.gallery.forEach((url, idx) => {
      assets.push({ type: 'image', url, alt: media.galleryAlts?.[idx] || `Gallery image ${idx + 1}` });
    });
  }

  if (assets.length === 0) {
    return (
      <div className="gallery-empty-state">
        <span className="gallery-empty-icon">🖼️</span>
        <p>No images available</p>
      </div>
    );
  }

  const currentAsset = assets[activeIndex];
  const imageAssets = assets.filter(a => a.type === 'image');

  const goNext = () => setActiveIndex(prev => Math.min(prev + 1, assets.length - 1));
  const goPrev = () => setActiveIndex(prev => Math.max(prev - 1, 0));

  // Mobile swipe handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      dx < 0 ? goNext() : goPrev();
    }
    touchStartX.current = null;
  };

  return (
    <div className="product-gallery-container">
      {/* Badge Overlay */}
      {badge && (
        <span className={`product-gallery-badge ${badge.toLowerCase().replace(/\s+/g, '-')}`}>
          {badge.toUpperCase()}
        </span>
      )}

      {/* Main Viewer */}
      <div className="gallery-main-viewer">
        {currentAsset.type === 'video' ? (
          <div className="gallery-video-wrapper">
            <video
              src={currentAsset.url}
              className="gallery-video-player"
              controls
              muted
            />
          </div>
        ) : (
          <div
            className="gallery-image-wrapper"
            onClick={() => setIsViewerOpen(true)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            role="button"
            aria-label="Click to zoom image"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setIsViewerOpen(true)}
          >
            <img src={currentAsset.url} alt={currentAsset.alt} className="gallery-main-img" />
            <span className="gallery-zoom-hint">🔍 Click to zoom</span>
          </div>
        )}

        {/* Prev / Next nav arrows (when multiple assets) */}
        {assets.length > 1 && (
          <>
            <button
              className="gallery-nav-btn gallery-nav-btn--prev"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              disabled={activeIndex === 0}
              aria-label="Previous image"
            >‹</button>
            <button
              className="gallery-nav-btn gallery-nav-btn--next"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              disabled={activeIndex === assets.length - 1}
              aria-label="Next image"
            >›</button>
          </>
        )}
      </div>

      {/* Thumbnails list */}
      {assets.length > 1 && (
        <div className="gallery-thumbnails-strip">
          {assets.map((asset, idx) => (
            <button
              key={idx}
              className={`gallery-thumb-btn ${idx === activeIndex ? 'active' : ''}`}
              onClick={() => setActiveIndex(idx)}
              aria-label={`View ${asset.alt}`}
            >
              {asset.type === 'video' ? (
                <div className="gallery-thumb-video-placeholder">
                  <span className="thumb-video-icon">▶</span>
                </div>
              ) : (
                <img src={asset.url} alt={asset.alt} className="gallery-thumb-img" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Image Viewer Modal */}
      {isViewerOpen && currentAsset.type === 'image' && (
        <ImageViewerModal
          assets={imageAssets}
          initialIndex={imageAssets.findIndex(a => a.url === currentAsset.url)}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </div>
  );
}
