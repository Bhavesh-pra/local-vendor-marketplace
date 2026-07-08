import { Star } from 'lucide-react';
import './index.css';

/**
 * StarRating — display or interactive star rating.
 *
 * Display mode (interactive=false): renders filled/empty star icons.
 * Interactive mode: renders accessible radio inputs styled as stars.
 *
 * @param {number}   value        Current rating (0–max)
 * @param {number}   [max=5]
 * @param {boolean}  [interactive=false]
 * @param {Function} [onChange]   Called with new numeric value (interactive mode)
 * @param {string}   [label]      Accessible label for fieldset (interactive mode)
 * @param {string}   [className]
 */
export function StarRating({
  value = 0,
  max = 5,
  interactive = false,
  onChange,
  label = 'Rating',
  className = '',
}) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  if (!interactive) {
    return (
      <span className={`star-rating ${className}`} aria-label={`${value} out of ${max} stars`}>
        {stars.map((star) => (
          <Star
            key={star}
            className={`star-rating__icon ${star <= Math.round(value) ? 'star-rating__icon--filled' : ''}`}
            size={14}
            aria-hidden="true"
          />
        ))}
      </span>
    );
  }

  return (
    <fieldset className={`star-rating star-rating--interactive ${className}`}>
      <legend className="sr-only">{label}</legend>
      {stars.map((star) => (
        <label key={star} className="star-rating__interactive-star">
          <input
            type="radio"
            className="sr-only"
            name={label}
            value={star}
            checked={value === star}
            onChange={() => onChange?.(star)}
          />
          <Star
            className={`star-rating__icon ${star <= value ? 'star-rating__icon--filled' : ''}`}
            size={20}
            aria-hidden="true"
          />
        </label>
      ))}
    </fieldset>
  );
}
