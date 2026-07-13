import { useState, useMemo } from 'react';
import { MessageSquare, Star, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { StarRating } from '../../../../components/ui/StarRating/index.jsx';
import { Skeleton } from '../../../../components/ui/Skeleton/index.jsx';
import { EmptyState } from '../../../../components/ui/EmptyState/index.jsx';
import { formatDate } from '../../../../utils/formatters.js';
import { voteHelpful } from '../../../../services/reviewService.js';
import { useToast } from '../../../../hooks/useToast.js';
import { useAuth } from '../../../../hooks/useAuth.js';
import './index.css';

const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest' },
  { value: 'oldest',   label: 'Oldest' },
  { value: 'highest',  label: 'Highest Rated' },
  { value: 'lowest',   label: 'Lowest Rated' },
  { value: 'helpful',  label: 'Most Helpful' },
];

/**
 * ReviewItem — individual review card with expandable comment, helpful button, and verified badge.
 */
function ReviewItem({ review }) {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(review.helpful_count ?? 0);
  const [markedHelpful, setMarkedHelpful] = useState(!!review.user_marked_helpful);
  const [activeImageIdx, setActiveImageIdx] = useState(null);

  const isLongText = review.comment && review.comment.length > 180;
  const displayComment = isLongText && !isExpanded
    ? `${review.comment.slice(0, 180)}...`
    : review.comment;

  const handleHelpful = async () => {
    if (!isAuthenticated) {
      showToast('info', 'Please log in to vote reviews as helpful.');
      return;
    }
    try {
      const data = await voteHelpful(review.review_id);
      setHelpfulCount(data.helpful_count);
      setMarkedHelpful(data.user_marked_helpful);
    } catch (err) {
      showToast('error', 'Failed to update helpful vote');
    }
  };

  const handlePrevImage = (e) => {
    e.stopPropagation();
    setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : review.images.length - 1));
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    setActiveImageIdx((prev) => (prev < review.images.length - 1 ? prev + 1 : 0));
  };

  return (
    <article className="reviews-section__item">
      <header className="reviews-section__item-header">
        <div className="reviews-section__user-info-row">
          <span className="reviews-section__username">{review.username}</span>
          <StarRating value={review.rating} />
          <span className="reviews-section__date">{formatDate(review.created_at)}</span>
        </div>
        {review.verified_purchase && (
          <span className="reviews-section__verified-badge">✓ Verified Purchase</span>
        )}
      </header>

      {review.title && (
        <h4 className="reviews-section__item-title">{review.title}</h4>
      )}

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

      {/* Review Images thumbnail gallery */}
      {review.images && review.images.length > 0 && (
        <div className="reviews-section__media-gallery">
          {review.images.map((img, idx) => (
            <button
              key={img.image_id}
              type="button"
              className="reviews-section__media-thumb"
              onClick={() => setActiveImageIdx(idx)}
            >
              <img src={`${import.meta.env.VITE_API_BASE_URL || ''}${img.image_url}`} alt="Attached review media" />
            </button>
          ))}
        </div>
      )}

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

      {/* Media Lightbox overlay dialog */}
      {activeImageIdx !== null && (
        <div className="reviews-lightbox" role="dialog" aria-modal="true" onClick={() => setActiveImageIdx(null)}>
          <button className="reviews-lightbox__close" onClick={() => setActiveImageIdx(null)}>
            <X size={24} />
          </button>
          {review.images.length > 1 && (
            <>
              <button className="reviews-lightbox__nav reviews-lightbox__nav--prev" onClick={handlePrevImage}>
                <ChevronLeft size={28} />
              </button>
              <button className="reviews-lightbox__nav reviews-lightbox__nav--next" onClick={handleNextImage}>
                <ChevronRight size={28} />
              </button>
            </>
          )}
          <div className="reviews-lightbox__content" onClick={(e) => e.stopPropagation()}>
            <img src={`${import.meta.env.VITE_API_BASE_URL || ''}${review.images[activeImageIdx].image_url}`} alt="Enlarged review media" />
          </div>
        </div>
      )}
    </article>
  );
}

/**
 * ReviewsSection — sortable list of product reviews.
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
      case 'oldest':
        return arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      case 'highest':
        return arr.sort((a, b) => b.rating - a.rating);
      case 'lowest':
        return arr.sort((a, b) => a.rating - b.rating);
      case 'helpful':
        return arr.sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0));
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
