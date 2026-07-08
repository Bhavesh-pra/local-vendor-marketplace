import { useEffect } from 'react';

/**
 * Set the document title for the current page.
 * Format: "Page Name | ShopCart"
 * If title is empty, renders "ShopCart" alone.
 *
 * @param {string} title  Page-specific title segment
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | ShopCart` : 'ShopCart';

    return () => {
      document.title = prev;
    };
  }, [title]);
}
