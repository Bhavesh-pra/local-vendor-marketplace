import { useToastContext } from '../../../context/ToastContext.jsx';
import { Toast } from './index.jsx';
import './index.css';

/**
 * ToastContainer — renders all active toasts in a fixed overlay region.
 * Place once in App.jsx, outside the route tree.
 */
export function ToastContainer() {
  const { toasts, dismissToast } = useToastContext();

  return (
    <div
      className="toast-container"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
