import { AlertCircle } from 'lucide-react';
import { Button } from '../Button/index.jsx';
import './index.css';

/**
 * ErrorState — displayed when an API call fails.
 *
 * @param {string}   [message]
 * @param {Function} [onRetry]  If provided, shows a "Try Again" button.
 */
export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="error-state" role="alert">
      <div className="error-state__icon-wrap" aria-hidden="true">
        <AlertCircle size={36} />
      </div>
      <p className="error-state__message">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
