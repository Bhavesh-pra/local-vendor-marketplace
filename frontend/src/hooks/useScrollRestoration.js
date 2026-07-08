import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scroll the window to the top on every route change.
 * Uses 'instant' behaviour to avoid visible scroll animation on navigation.
 * Place this hook in the App shell so it fires on every navigation.
 */
export function useScrollRestoration() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
}
