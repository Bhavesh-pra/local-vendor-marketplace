/** Product categories — mirrors seeded database values */
export const CATEGORIES = [
  { id: 1, name: 'Clothes',      slug: 'clothes' },
  { id: 2, name: 'Electronics',  slug: 'electronics' },
  { id: 3, name: 'Accessories',  slug: 'accessories' },
  { id: 4, name: 'Furniture',    slug: 'furniture' },
  { id: 5, name: 'Others',       slug: 'others' },
];

/** All-products sentinel used in category filter */
export const ALL_CATEGORIES = { id: 0, name: 'All', slug: 'all' };
