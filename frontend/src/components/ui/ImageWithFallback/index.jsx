/**
 * ImageWithFallback — renders an <img> with lazy loading, async decoding,
 * and graceful fallback to an inline SVG placeholder on load error.
 *
 * @param {string}  src
 * @param {string}  alt       Required. Provide a meaningful description.
 * @param {string}  [className]
 * @param {boolean} [eager]   If true, sets loading="eager" and fetchpriority="high" (for LCP images)
 */
export function ImageWithFallback({ src, alt, className = '', eager = false, ...rest }) {
  const PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='400' height='400' fill='%231e2230'/><path d='M160 150h80v80h-80z' fill='none' stroke='%2333395a' stroke-width='2'/><circle cx='185' cy='175' r='12' fill='%2333395a'/><path d='M155 205l35-30 25 22 20-18 30 26' fill='none' stroke='%2333395a' stroke-width='2'/><text x='200' y='260' text-anchor='middle' fill='%2333395a' font-size='12' font-family='sans-serif'>No image</text></svg>`;

  function handleError(e) {
    if (e.target.src !== PLACEHOLDER) {
      e.target.src = PLACEHOLDER;
    }
  }

  return (
    <img
      src={src || PLACEHOLDER}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : undefined}
      onError={handleError}
      {...rest}
    />
  );
}
