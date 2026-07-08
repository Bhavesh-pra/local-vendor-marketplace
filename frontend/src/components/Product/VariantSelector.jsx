import React from 'react';
import './VariantSelector.css';

export default function VariantSelector({
  variants = [],
  selectedColor,
  selectedSize,
  onSelectColor,
  onSelectSize
}) {
  if (variants.length <= 1 && !variants[0]?.size && (!variants[0]?.color || variants[0]?.color === 'Default')) {
    return null; // No options to select
  }

  // Get unique colors and sizes
  const colors = Array.from(new Set(variants.map(v => v.color || 'Default')));
  const sizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean)));

  // Helper to check stock/availability for color + size combinations
  const checkCombinationState = (color, size) => {
    const match = variants.find(
      v => (v.color || 'Default') === color && (size ? v.size === size : true)
    );
    if (!match) return 'unavailable'; // Does not exist
    if (match.available_stock <= 0) return 'outofstock'; // Out of stock
    return 'available';
  };

  return (
    <div className="variant-selector-wrapper">
      {colors.length > 1 && (
        <div className="variant-group">
          <label className="variant-group-label">Color: <span className="selected-val">{selectedColor}</span></label>
          <div className="variant-options">
            {colors.map((color) => {
              const matchesColor = checkCombinationState(color, selectedSize);
              const isSelected = selectedColor === color;
              
              return (
                <button
                  key={color}
                  type="button"
                  className={`variant-pill color-pill ${isSelected ? 'active' : ''} ${matchesColor === 'unavailable' ? 'disabled' : ''}`}
                  onClick={() => onSelectColor(color)}
                >
                  <span className="color-dot" style={{ backgroundColor: color.toLowerCase() }} />
                  {color}
                  {matchesColor === 'outofstock' && <span className="pill-sub"> (Out of Stock)</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div className="variant-group">
          <label className="variant-group-label">Size: <span className="selected-val">{selectedSize}</span></label>
          <div className="variant-options">
            {sizes.map((size) => {
              const state = checkCombinationState(selectedColor, size);
              const isSelected = selectedSize === size;

              return (
                <button
                  key={size}
                  type="button"
                  className={`variant-pill size-pill ${isSelected ? 'active' : ''} ${state === 'unavailable' ? 'disabled' : ''} ${state === 'outofstock' ? 'out-of-stock' : ''}`}
                  disabled={state === 'unavailable'}
                  onClick={() => onSelectSize(size)}
                >
                  {size}
                  {state === 'outofstock' && <span className="stock-line" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
