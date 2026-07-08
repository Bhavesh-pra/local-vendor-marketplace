/**
 * Search and filter utilities for product lists.
 * Pure functions — no React, no side effects.
 */

/**
 * Normalise a raw search query:
 *  - Trim leading/trailing whitespace
 *  - Collapse multiple spaces into one
 *  - Convert to lowercase
 * @param {string} raw
 * @returns {string}
 */
export function normalizeQuery(raw) {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Check whether a product name matches a normalised query.
 * @param {string} productName
 * @param {string} normalizedQuery  Already normalised via normalizeQuery()
 * @returns {boolean}
 */
export function matchesQuery(productName, normalizedQuery) {
  if (!normalizedQuery) return true;
  return String(productName).toLowerCase().includes(normalizedQuery);
}

/**
 * Filter and sort a products array.
 * Does not mutate the input array.
 *
 * @param {Array}  products     Raw products from the API
 * @param {string} query        Raw (un-normalised) search query
 * @param {string} category     Category slug, or 'all' / '' for no filter
 * @param {string} sortOption   One of: 'default' | 'price-asc' | 'price-desc' | 'rating-desc'
 * @returns {Array}
 */
export function filterProducts(products, query, category, sortOption) {
  if (!Array.isArray(products)) return [];

  const normalizedQuery = normalizeQuery(query);
  const activeCategory = category && category !== 'all' ? category.toLowerCase() : null;

  let result = products.filter((product) => {
    const matchesSearch = matchesQuery(product.product_name, normalizedQuery);
    const matchesCategory = activeCategory
      ? String(product.category).toLowerCase() === activeCategory
      : true;
    return matchesSearch && matchesCategory;
  });

  switch (sortOption) {
    case 'price-asc':
      result = [...result].sort((a, b) => a.selling_price - b.selling_price);
      break;
    case 'price-desc':
      result = [...result].sort((a, b) => b.selling_price - a.selling_price);
      break;
    case 'rating-desc':
      result = [...result].sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
      break;
    case 'discount-desc':
      result = [...result].sort((a, b) => {
        const discA = a.mrp && a.mrp > 0 ? (a.mrp - a.selling_price) / a.mrp : 0;
        const discB = b.mrp && b.mrp > 0 ? (b.mrp - b.selling_price) / b.mrp : 0;
        return discB - discA;
      });
      break;
    case 'newest':
      result = [...result].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
    default:
      // 'default' — preserve original API order
      break;
  }

  return result;
}
