import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ImageViewerModal.css';

const ZOOM_LEVELS = [
  { label: 'Fit', value: 'fit' },
  { label: '100%', value: 1 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
];

/**
 * ImageViewerModal — fullscreen image viewer with zoom, pan, keyboard nav.
 *
 * @param {Array}    assets        Array of { url, alt } image objects
 * @param {number}   initialIndex  Index to start on
 * @param {Function} onClose       Called when viewer should close
 */
export default function ImageViewerModal({ assets, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState('fit');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);
  const containerRef = useRef(null);

  const currentAsset = assets[currentIndex];
  const scale = zoomLevel === 'fit' ? 1 : zoomLevel;
  const isPanned = zoomLevel !== 'fit' && zoomLevel > 1;

  // Reset pan when zoom or image changes
  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [zoomLevel, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, assets.length]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const goNext = useCallback(() => {
    if (currentIndex < assets.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setZoomLevel('fit');
    }
  }, [currentIndex, assets.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setZoomLevel('fit');
    }
  }, [currentIndex]);

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const currentIdx = ZOOM_LEVELS.findIndex(z => z.value === zoomLevel);
    if (e.deltaY < 0 && currentIdx < ZOOM_LEVELS.length - 1) {
      setZoomLevel(ZOOM_LEVELS[currentIdx + 1].value);
    } else if (e.deltaY > 0 && currentIdx > 0) {
      setZoomLevel(ZOOM_LEVELS[currentIdx - 1].value);
    }
  };

  // Drag to pan
  const handleMouseDown = (e) => {
    if (!isPanned) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart.current) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStart.current = null;
  };

  // Touch pinch-to-zoom (simplified: double-tap to toggle)
  const lastTap = useRef(0);
  const handleTouchEnd = (e) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap
      setZoomLevel(prev => prev === 'fit' ? 1.5 : 'fit');
    }
    lastTap.current = now;
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const imageStyle = {
    transform: `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px)`,
    cursor: isPanned ? (isDragging ? 'grabbing' : 'grab') : 'default',
    transition: isDragging ? 'none' : 'transform 200ms ease-out',
  };

  return (
    <div
      className="ivm-backdrop"
      onClick={handleBackdropClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Controls Bar */}
      <div className="ivm-controls-top">
        <span className="ivm-counter">{currentIndex + 1} / {assets.length}</span>

        <div className="ivm-zoom-bar">
          {ZOOM_LEVELS.map((z) => (
            <button
              key={z.label}
              className={`ivm-zoom-btn ${zoomLevel === z.value ? 'active' : ''}`}
              onClick={() => setZoomLevel(z.value)}
            >
              {z.label}
            </button>
          ))}
          <button
            className="ivm-zoom-btn ivm-reset-btn"
            onClick={() => { setZoomLevel('fit'); setPan({ x: 0, y: 0 }); }}
            title="Reset zoom"
          >
            ↺
          </button>
        </div>

        <button className="ivm-close-btn" onClick={onClose} aria-label="Close viewer">✕</button>
      </div>

      {/* Main Image */}
      <div
        ref={containerRef}
        className="ivm-image-area"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={currentAsset.url}
          alt={currentAsset.alt}
          className="ivm-main-img"
          style={imageStyle}
          draggable={false}
        />
      </div>

      {/* Prev / Next */}
      {assets.length > 1 && (
        <>
          <button
            className="ivm-nav-btn ivm-nav-prev"
            onClick={goPrev}
            disabled={currentIndex === 0}
            aria-label="Previous image"
          >‹</button>
          <button
            className="ivm-nav-btn ivm-nav-next"
            onClick={goNext}
            disabled={currentIndex === assets.length - 1}
            aria-label="Next image"
          >›</button>
        </>
      )}

      {/* Bottom Thumbnails */}
      {assets.length > 1 && (
        <div className="ivm-thumbs-strip">
          {assets.map((asset, idx) => (
            <button
              key={idx}
              className={`ivm-thumb ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => { setCurrentIndex(idx); setZoomLevel('fit'); }}
            >
              <img src={asset.url} alt={asset.alt} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
