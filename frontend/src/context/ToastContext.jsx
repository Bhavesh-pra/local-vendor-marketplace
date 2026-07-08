import { createContext, useContext, useState, useMemo, useCallback } from 'react';

const ToastContext = createContext(null);

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /**
   * Show a toast notification.
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {string} message
   * @param {number} duration  Auto-dismiss delay in ms (default 4000)
   */
  const showToast = useCallback((type, message, duration = 4000) => {
    const id = ++nextId;
    setToasts((prev) => {
      // Keep at most 4 toasts; remove oldest if needed
      const next = prev.length >= 4 ? prev.slice(1) : prev;
      return [...next, { id, type, message, duration }];
    });
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastContext must be used inside <ToastProvider>');
  return ctx;
}
