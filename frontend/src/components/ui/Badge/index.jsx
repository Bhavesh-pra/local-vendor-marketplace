import './index.css';

/**
 * Badge — small coloured label.
 *
 * @param {'default'|'success'|'error'|'warning'|'info'|'brand'} variant
 * @param {import('react').ReactNode} children
 * @param {string} [className]
 */
export function Badge({ variant = 'default', children, className = '' }) {
  return (
    <span className={`badge badge--${variant} ${className}`}>
      {children}
    </span>
  );
}
