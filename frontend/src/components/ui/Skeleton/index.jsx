import './index.css';

/**
 * Skeleton — shimmer placeholder matching final content dimensions.
 *
 * @param {string} [width='100%']
 * @param {string} [height='1em']
 * @param {string} [borderRadius]
 * @param {string} [className]
 */
export function Skeleton({ width = '100%', height = '1em', borderRadius, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: borderRadius ?? 'var(--radius-md)',
      }}
      aria-hidden="true"
    />
  );
}
