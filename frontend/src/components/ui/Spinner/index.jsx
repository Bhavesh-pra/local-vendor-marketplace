import './index.css';

/**
 * Spinner — loading indicator.
 * @param {'sm'|'md'|'lg'} size
 * @param {string} [className]
 */
export function Spinner({ size = 'md', className = '' }) {
  return (
    <span
      className={`spinner spinner--${size} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
