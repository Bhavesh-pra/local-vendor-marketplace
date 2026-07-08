import { useEffect, useCallback, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import './index.css';

const ICONS = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
};

/**
 * Toast — single notification item with pause-on-hover behavior.
 *
 * @param {{ id: number, type: string, message: string, duration: number }} toast
 * @param {Function} onDismiss
 */
export function Toast({ toast, onDismiss }) {
  const { id, type, message, duration } = toast;
  const Icon = ICONS[type] ?? Info;
  const timerRef = useRef(null);

  const dismiss = useCallback(() => onDismiss(id), [id, onDismiss]);

  const startTimer = useCallback(() => {
    if (!duration) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(dismiss, duration);
  }, [dismiss, duration]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startTimer();
    return () => clearTimer();
  }, [startTimer, clearTimer]);

  const handleMouseEnter = () => {
    clearTimer();
  };

  const handleMouseLeave = () => {
    startTimer();
  };

  return (
    <div
      className={`toast toast--${type}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Icon className="toast__icon" size={18} aria-hidden="true" />
      <p className="toast__message">{message}</p>
      <button
        className="toast__close"
        onClick={dismiss}
        aria-label="Dismiss notification"
        type="button"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
