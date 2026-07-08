import { Search } from 'lucide-react';
import './index.css';

/**
 * SearchBar — controlled text input for product search.
 * Debounce logic lives in the parent page.
 *
 * @param {string}   value
 * @param {Function} onChange  Called with raw input value string
 */
export function SearchBar({ value, onChange }) {
  return (
    <div className="search-bar">
      <label htmlFor="product-search" className="sr-only">
        Search products
      </label>
      <Search
        className="search-bar__icon"
        size={18}
        aria-hidden="true"
      />
      <input
        id="product-search"
        type="search"
        className="search-bar__input"
        placeholder="Search products…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {value && (
        <button
          className="search-bar__clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
}
