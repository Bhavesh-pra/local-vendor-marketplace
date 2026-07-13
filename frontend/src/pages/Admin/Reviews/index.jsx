import { useState, useEffect } from 'react';
import { Search, Star, EyeOff, Check, Image as ImageIcon } from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

const TABS = [
  { id: 'approved', label: 'Approved / Visible' },
  { id: 'hidden', label: 'Hidden / Moderated' }
];

export default function Reviews() {
  useDocumentTitle('Reviews Moderation — ShopCart Admin');
  const { showToast } = useToast();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('approved'); // approved | hidden

  // Moderation modal state
  // { review_id, status, notes }
  const [moderatingReview, setModeratingReview] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllReviews();
      setReviews(data);
      setError(null);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch reviews');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleModerationSubmit = async (e) => {
    e.preventDefault();
    if (!moderatingReview) return;

    setActionLoading(true);
    try {
      await adminService.updateReviewStatus(
        moderatingReview.review_id,
        moderatingReview.status,
        moderatingReview.notes.trim()
      );
      showToast('success', `Review successfully marked as ${moderatingReview.status}`);
      setModeratingReview(null);
      await fetchReviews();
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to update review status');
      showToast('error', errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    const matchesTab = r.status === activeTab;

    const term = searchQuery.toLowerCase();
    const matchesSearch =
      r.product_name.toLowerCase().includes(term) ||
      r.username.toLowerCase().includes(term) ||
      (r.title && r.title.toLowerCase().includes(term)) ||
      (r.comment && r.comment.toLowerCase().includes(term));

    const matchesRating =
      ratingFilter === 'all' || r.rating === parseInt(ratingFilter, 10);

    return matchesTab && matchesSearch && matchesRating;
  });

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderStars = (rating) => {
    return (
      <div className="reviews-page__stars" aria-label={`Rating: ${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={star <= rating ? 'reviews-page__star--filled' : 'reviews-page__star--empty'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="reviews-page">
      <header className="ap-header">
        <div>
          <h1 className="ap-title">Reviews</h1>
          <p className="ap-subtitle">Monitor and moderate product reviews and customer feedback</p>
        </div>
      </header>

      {error && (
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button className="ap-btn ap-btn--primary" onClick={fetchReviews} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="ap-loading">
          <Spinner size="lg" />
        </div>
      ) : !error && (
        <div className="ap-card">
          {/* Moderation Tabs */}
          <div className="reviews-page__tabs" role="tablist">
            {TABS.map((tab) => {
              const count = reviews.filter(r => r.status === tab.id).length;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`reviews-page__tab ${activeTab === tab.id ? 'reviews-page__tab--active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setModeratingReview(null);
                  }}
                >
                  <span>{tab.label}</span>
                  <span className="reviews-page__tab-badge">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="reviews-page__toolbar">
            <div className="reviews-page__search-wrap">
              <Search className="reviews-page__search-icon" size={18} />
              <input
                type="text"
                placeholder="Search by product, customer, title or comment..."
                className="ap-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="reviews-page__filters">
              <select
                className="ap-select reviews-page__filter-rating"
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
              >
                <option value="all">All Ratings</option>
                <option value="5">5 ★ Only</option>
                <option value="4">4 ★ & Above</option>
                <option value="3">3 ★ & Above</option>
                <option value="2">2 ★ & Above</option>
                <option value="1">1 ★ Only</option>
              </select>
              <span className="reviews-page__count">
                Showing {filteredReviews.length} of {reviews.filter(r => r.status === activeTab).length} reviews
              </span>
            </div>
          </div>

          {filteredReviews.length === 0 ? (
            <div className="ap-empty">
              <p>No reviews found matching the criteria.</p>
            </div>
          ) : (
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Rating</th>
                    <th>Details</th>
                    <th>Images</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.map((r) => (
                    <tr key={r.review_id}>
                      <td style={{ fontWeight: '500', maxWidth: '160px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.product_name}>
                          {r.product_name}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '500' }}>@{r.username}</div>
                        {r.verified_purchase && (
                          <span className="reviews-page__verified-label">✓ Verified Buyer</span>
                        )}
                      </td>
                      <td>{renderStars(r.rating)}</td>
                      <td>
                        <div className="reviews-page__details-cell">
                          {r.title && <strong className="reviews-page__comment-title">{r.title}</strong>}
                          <span className="reviews-page__comment-text">{r.comment || '(No review body)'}</span>
                        </div>
                      </td>
                      <td>
                        {r.images && r.images.length > 0 ? (
                          <div className="reviews-page__images-gallery">
                            {r.images.map((img) => (
                              <a
                                key={img.image_id}
                                href={`${import.meta.env.VITE_API_BASE_URL || ''}${img.image_url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="reviews-page__image-thumb"
                              >
                                <img src={`${import.meta.env.VITE_API_BASE_URL || ''}${img.image_url}`} alt="Review attachment" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td>{formatDate(r.created_at)}</td>
                      <td>
                        <div className="ap-actions" style={{ justifyContent: 'flex-end' }}>
                          {r.status === 'approved' ? (
                            <button
                              className="ap-btn ap-btn--sm ap-btn--danger"
                              onClick={() => setModeratingReview({
                                review_id: r.review_id,
                                status: 'hidden',
                                notes: ''
                              })}
                            >
                              <EyeOff size={14} />
                              <span>Hide Review</span>
                            </button>
                          ) : (
                            <button
                              className="ap-btn ap-btn--sm ap-btn--success"
                              onClick={() => setModeratingReview({
                                review_id: r.review_id,
                                status: 'approved',
                                notes: ''
                              })}
                            >
                              <Check size={14} />
                              <span>Restore Review</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Moderation Notes Dialog */}
      {moderatingReview && (
        <div className="reviews-moderation-modal-overlay" role="dialog" aria-modal="true">
          <div className="reviews-moderation-modal">
            <header className="reviews-moderation-modal__header">
              <h3>Moderate Review: Mark as {moderatingReview.status === 'hidden' ? 'Hidden' : 'Approved'}</h3>
            </header>
            <form onSubmit={handleModerationSubmit} className="reviews-moderation-modal__form">
              <div className="reviews-moderation-modal__field">
                <label htmlFor="moderation-notes">Moderation Reason / Log Notes *</label>
                <textarea
                  id="moderation-notes"
                  placeholder="Enter logs or update notes for this moderation action..."
                  rows={4}
                  value={moderatingReview.notes}
                  onChange={(e) => setModeratingReview({ ...moderatingReview, notes: e.target.value })}
                  required
                />
              </div>
              <footer className="reviews-moderation-modal__footer">
                <button
                  type="button"
                  className="ap-btn ap-btn--secondary"
                  onClick={() => setModeratingReview(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ap-btn ap-btn--primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? <Spinner size="sm" /> : 'Confirm Status Change'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
