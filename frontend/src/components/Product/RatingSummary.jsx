import './RatingSummary.css';

export default function RatingSummary({ rating = 0, reviewsCount = 0 }) {
  const roundedRating = Number(rating || 0).toFixed(1);
  const stars = Math.round(Number(rating || 0));

  if (Number(rating || 0) === 0 || Number(reviewsCount || 0) === 0) {
    return (
      <div className="rating-summary-container">
        <span className="rating-no-ratings">No ratings yet</span>
      </div>
    );
  }

  return (
    <div className="rating-summary-container">
      <div className="rating-stars" aria-label={`Rating: ${roundedRating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`rating-star ${star <= stars ? 'filled' : ''}`}
          >
            ★
          </span>
        ))}
      </div>
      <span className="rating-number">{roundedRating}</span>
      <span className="rating-count-sep">•</span>
      <span className="rating-reviews-count">
        {reviewsCount} Review{reviewsCount > 1 ? 's' : ''}
      </span>
    </div>
  );
}
