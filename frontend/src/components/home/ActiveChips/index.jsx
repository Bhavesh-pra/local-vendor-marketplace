import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { CATEGORIES } from '../../../constants/categories.js';
import './index.css';

const PRICE_LABELS = {
  'under500': 'Under ₹500',
  '500-2000': '₹500 – ₹2,000',
  '2000-5000': '₹2,000 – ₹5,000',
  '5000+': '₹5,000+',
};

export function ActiveChips() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeCategory = searchParams.get('category') || 'all';
  const brand = searchParams.get('brand') || '';
  const priceRange = searchParams.get('priceRange') || '';
  const rating = searchParams.get('rating') || '';
  const inStock = searchParams.get('stock') === 'true';

  const chips = useMemo(() => {
    const list = [];

    if (activeCategory !== 'all') {
      const cat = CATEGORIES.find(c => c.slug === activeCategory);
      list.push({
        id: 'category',
        label: cat ? cat.name : activeCategory,
      });
    }

    if (brand) {
      list.push({
        id: 'brand',
        label: `Brand: ${brand}`,
      });
    }

    if (priceRange && PRICE_LABELS[priceRange]) {
      list.push({
        id: 'priceRange',
        label: PRICE_LABELS[priceRange],
      });
    }

    if (rating) {
      list.push({
        id: 'rating',
        label: `${rating}★ & above`,
      });
    }

    if (inStock) {
      list.push({
        id: 'stock',
        label: 'In Stock',
      });
    }

    return list;
  }, [activeCategory, brand, priceRange, rating, inStock]);

  const removeFilter = (id) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete(id);
      next.delete('page'); // Reset to page 1 on filter changes
      return next;
    });
  };

  const clearAllFilters = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams();
      const q = prev.get('q');
      if (q) {
        next.set('q', q);
      }
      return next;
    });
  };

  if (chips.length === 0) return null;

  return (
    <div className="active-chips" aria-label="Active filters">
      <div className="active-chips__scroll-container">
        {chips.map(chip => (
          <div key={chip.id} className="active-chips__chip">
            <span className="active-chips__chip-label">{chip.label}</span>
            <button
              type="button"
              className="active-chips__chip-remove-btn"
              onClick={() => removeFilter(chip.id)}
              aria-label={`Remove filter: ${chip.label}`}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="active-chips__clear-all-btn"
          onClick={clearAllFilters}
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}
