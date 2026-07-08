import { useToastContext } from '../context/ToastContext.jsx';

/**
 * Convenience hook — subscribes to ToastContext.
 * Exposes: showToast, dismissToast.
 */
export function useToast() {
  const { showToast, dismissToast } = useToastContext();
  return { showToast, dismissToast };
}
