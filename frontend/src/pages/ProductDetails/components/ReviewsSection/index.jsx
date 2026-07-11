import { useState, useMemo, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { StarRating } from '../../../../components/ui/StarRating/index.jsx';
import { Skeleton } from '../../../../components/ui/Skeleton/index.jsx';
import { EmptyState } from '../../../../components/ui/EmptyState/index.jsx';
import { formatDate } from '../../../../utils/formatters.js';
import './index.css';

const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest' },
  { value: 'highest',  label: 'Highest Rated' },
  { value: 'lowest',   label: 'Lowest Rated' },
];

/**
 * ReviewItem — individual review card with expandable comment, helpful button, and verified badge.
 */
function ReviewItem({ review }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(review.helpful_count ?? review.helpful ?? 0);
  const [markedHelpful, setMarkedHelpful] = useState(false);

  const isLongText = review.comment && review.comment.length > 180;
  const displayComment = isLongText && !isExpanded
    ? `${review.comment.slice(0, 180)}...`
    : review.comment;

  const handleHelpful = () => {
    if (markedHelpful) {
      setHelpfulCount(c => c - 1);
    } else {
      setHelpfulCount(c => c + 1);
    }
    setMarkedHelpful(prev => !prev);
  };

  return (
    <article className="reviews-section__item">
      <header className="reviews-section__item-header">
        <div className="reviews-section__user-info-row">
          <span className="reviews-section__username">{review.username}</span>
          <StarRating value={review.rating} />
          <span className="reviews-section__date">{formatDate(review.created_at)}</span>
        </div>
        {(review.verified || review.verified_purchase) && (
          <span className="reviews-section__verified-badge">✓ Verified Purchase</span>
        )}
      </header>

      <p className="reviews-section__comment">
        {displayComment}
        {isLongText && (
          <button
            type="button"
            className="reviews-section__comment-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? ' Show less' : ' Read more'}
          </button>
        )}
      </p>

      <div className="reviews-section__item-footer">
        <button
          type="button"
          className={`reviews-section__helpful-btn ${markedHelpful ? 'reviews-section__helpful-btn--active' : ''}`}
          onClick={handleHelpful}
          aria-pressed={markedHelpful}
        >
          <span>👍 Helpful</span> {helpfulCount > 0 && <span className="helpful-count">({helpfulCount})</span>}
        </button>
      </div>
    </article>
  );
}

/**
 * ReviewsSection — sortable list of product reviews.
 *
 * @param {object[]} reviews
 * @param {boolean}  loading
 */
export function ReviewsSection({
  reviews,
  loading,
  visibleCount = 3,
  hasNext = false,
  totalCount = 0,
  onLoadMore,
  onShowLess
}) {
  const [sortBy, setSortBy] = useState('newest');

  const sortedReviews = useMemo(() => {
    const arr = [...reviews];
    switch (sortBy) {
      case 'highest':
        return arr.sort((a, b) => b.rating - a.rating);
      case 'lowest':
        return arr.sort((a, b) => a.rating - b.rating);
      case 'newest':
      default:
        return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  }, [reviews, sortBy]);

  const visibleReviews = useMemo(() => {
    return sortedReviews.slice(0, visibleCount);
  }, [sortedReviews, visibleCount]);

  if (loading) {
    return (
      <div className="reviews-section">
        <h2 className="reviews-section__title">Customer Reviews</h2>
        <div className="reviews-section__list">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="reviews-section__item-skeleton">
              <div className="reviews-section__item-header-skeleton">
                <Skeleton width="120px" height="18px" borderRadius="var(--radius-sm)" />
                <Skeleton width="80px" height="14px" borderRadius="var(--radius-sm)" />
              </div>
              <Skeleton width="100px" height="14px" borderRadius="var(--radius-sm)" style={{ marginBlock: 'var(--space-2)' }} />
              <Skeleton width="100%" height="32px" borderRadius="var(--radius-sm)" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="reviews-section">
      <div className="reviews-section__header-row">
        <h2 className="reviews-section__title">
          Customer Reviews {totalCount > 0 && `(${totalCount})`}
        </h2>

        {reviews.length > 1 && (
          <div className="reviews-section__sort-wrap">
            <label htmlFor="reviews-sort" className="reviews-section__sort-label">Sort by</label>
            <select
              id="reviews-sort"
              className="reviews-section__sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {sortedReviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          heading="No reviews yet"
          body="Be the first to share your experience with this product!"
        />
      ) : (
        <div className="reviews-section__list">
          {visibleReviews.map((review) => (
            <ReviewItem key={review.review_id} review={review} />
          ))}

          <div className="reviews-section__pagination">
            <p className="reviews-section__pagination-info">
              Showing {Math.min(visibleCount, totalCount)} of {totalCount} reviews
            </p>
            {hasNext ? (
              <button
                type="button"
                className="reviews-section__load-btn"
                onClick={onLoadMore}
              >
                Load More Reviews
              </button>
            ) : totalCount > 3 ? (
              <button
                type="button"
                className="reviews-section__load-btn"
                onClick={onShowLess}
              >
                Show Less
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
