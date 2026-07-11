import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import './index.css';

const SORT_OPTIONS = [
  { value: 'relevance',     label: 'Relevance' },
  { value: 'popularity',    label: 'Popularity' },
  { value: 'newest',        label: 'Newest' },
  { value: 'price_asc',     label: 'Price: Low to High' },
  { value: 'price_desc',    label: 'Price: High to Low' },
  { value: 'rating_desc',   label: 'Top Rated' },
  { value: 'discount_desc', label: 'Highest Discount' },
];

export function MobileSortSheet({ isOpen, onClose }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSort = searchParams.get('sort') || 'relevance';

  // Prevent background scrolling when bottom sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('sort', val);
      return next;
    });
    onClose();
  };

  return (
    <div className="mobile-sort-sheet-container" role="dialog" aria-modal="true" aria-label="Sort Options">
      {/* Backdrop */}
      <div className="mobile-sort-sheet__backdrop" onClick={onClose} aria-hidden="true" />
      
      {/* Bottom Sheet Wrapper */}
      <div className="mobile-sort-sheet__content">
        <div className="mobile-sort-sheet__header">
          <span className="mobile-sort-sheet__title">Sort By</span>
          <button
            type="button"
            className="mobile-sort-sheet__close-btn"
            onClick={onClose}
            aria-label="Close sorting options"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <ul className="mobile-sort-sheet__options-list">
          {SORT_OPTIONS.map(opt => {
            const isSelected = currentSort === opt.value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  className={`mobile-sort-sheet__option-btn ${isSelected ? 'mobile-sort-sheet__option-btn--selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span className="mobile-sort-sheet__option-label">{opt.label}</span>
                  {isSelected && <Check size={18} className="mobile-sort-sheet__check-icon" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
