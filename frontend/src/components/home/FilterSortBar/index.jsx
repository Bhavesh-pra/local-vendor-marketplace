import './index.css';

const SORT_OPTIONS = [
  { value: 'default',    label: 'Featured' },
  { value: 'price-asc',  label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating-desc', label: 'Top Rated' },
];

/**
 * FilterSortBar — sort dropdown for the product grid.
 *
 * @param {string}   sortOption
 * @param {Function} onSortChange  Called with the selected sort value string
 * @param {number}   resultCount   Total visible products (displayed as context)
 */
export function FilterSortBar({ sortOption, onSortChange, resultCount }) {
  return (
    <div className="filter-sort-bar">
      {resultCount != null && (
        <p className="filter-sort-bar__count" aria-live="polite" aria-atomic="true">
          {resultCount} product{resultCount !== 1 ? 's' : ''} found
        </p>
      )}

      <div className="filter-sort-bar__sort">
        <label htmlFor="sort-select" className="filter-sort-bar__label">
          Sort by
        </label>
        <select
          id="sort-select"
          className="filter-sort-bar__select"
          value={sortOption}
          onChange={(e) => onSortChange(e.target.value)}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
