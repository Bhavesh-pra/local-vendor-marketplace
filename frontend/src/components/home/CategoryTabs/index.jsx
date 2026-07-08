import './index.css';

/**
 * CategoryTabs — horizontal tab list for filtering products by category.
 *
 * @param {{ id: number, name: string, slug: string }[]} categories
 * @param {string}   activeCategory  Active slug, or 'all'
 * @param {Function} onCategoryChange  Called with slug string
 */
export function CategoryTabs({ categories, activeCategory, onCategoryChange }) {
  return (
    <div className="category-tabs" role="tablist" aria-label="Filter by category">
      {categories.map((cat) => {
        const isActive = cat.slug === activeCategory;
        return (
          <button
            key={cat.id}
            role="tab"
            aria-selected={isActive}
            className={`category-tabs__tab ${isActive ? 'category-tabs__tab--active' : ''}`}
            onClick={() => onCategoryChange(cat.slug)}
            type="button"
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
