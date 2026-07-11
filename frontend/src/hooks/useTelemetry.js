import { useCallback } from 'react';
import { trackTelemetryEvent } from '../services/telemetryService.js';

export function useTelemetry() {
  const trackEvent = useCallback((eventName, data = {}) => {
    // 1. Duplicate prevention for product_view (once per product per session every 30 minutes)
    if (eventName === 'product_view') {
      const prodId = data.productId;
      if (!prodId) return;

      try {
        const viewsStr = sessionStorage.getItem('shopcart_product_views') || '{}';
        const viewsMap = JSON.parse(viewsStr);
        const lastViewTime = viewsMap[prodId];
        const now = Date.now();

        // 30 minutes = 1,800,000 milliseconds
        if (lastViewTime && now - lastViewTime < 1800000) {
          return; // Skip duplicate view
        }

        // Record timestamp
        viewsMap[prodId] = now;
        sessionStorage.setItem('shopcart_product_views', JSON.stringify(viewsMap));
      } catch (_) {}
    }

    // 2. Search Event Spam Prevention (query length >= 3 and query changed from previous)
    if (eventName === 'search_used') {
      const query = (data.metadata?.query || '').trim().toLowerCase();

      if (query.length < 3) {
        return; // Ignore queries shorter than 3 characters
      }

      try {
        const lastQuery = sessionStorage.getItem('shopcart_last_search_query') || '';
        if (query === lastQuery) {
          return; // Ignore repeating searches
        }

        // Record query
        sessionStorage.setItem('shopcart_last_search_query', query);
      } catch (_) {}
    }

    // Call service to post event
    trackTelemetryEvent(eventName, data);
  }, []);

  return { trackEvent };
}
