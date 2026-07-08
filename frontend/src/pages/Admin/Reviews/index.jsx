import { useState, useEffect } from 'react';
import { Search, Trash2, Star, AlertTriangle } from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

export default function Reviews() {
  useDocumentTitle('Reviews — ShopCart Admin');
  const { showToast } = useToast();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');

  // Track the ID of the review currently in the 'confirm delete' state
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleDeleteClick = (id) => {
    if (confirmDeleteId === id) {
      // Second click: perform delete
      executeDelete(id);
    } else {
      // First click: prompt confirm
      setConfirmDeleteId(id);
    }
  };

  const executeDelete = async (id) => {
    try {
      setDeleteLoading(true);
      await adminService.deleteReview(id);
      showToast('success', 'Review deleted successfully');
      setReviews((prev) => prev.filter((r) => r.review_id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to delete review');
      showToast('error', errMsg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      r.product_name.toLowerCase().includes(term) ||
      r.username.toLowerCase().includes(term);

    const matchesRating =
      ratingFilter === 'all' || r.rating === parseInt(ratingFilter, 10);

    return matchesSearch && matchesRating;
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
          <div className="reviews-page__toolbar">
            <div className="reviews-page__search-wrap">
              <Search className="reviews-page__search-icon" size={18} />
              <input
                type="text"
                placeholder="Search by product name or customer name..."
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
                Showing {filteredReviews.length} of {reviews.length} reviews
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
                    <th>Comment</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.map((r) => {
                    const isConfirming = confirmDeleteId === r.review_id;
                    return (
                      <tr key={r.review_id}>
                        <td style={{ fontWeight: '500', maxWidth: '160px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.product_name}>
                            {r.product_name}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '500' }}>@{r.username}</div>
                        </td>
                        <td>{renderStars(r.rating)}</td>
                        <td>
                          <div className="reviews-page__comment" title={r.comment}>
                            {r.comment || <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>No comment text</span>}
                          </div>
                        </td>
                        <td>{formatDate(r.created_at)}</td>
                        <td>
                          <div className="ap-actions" style={{ justifyContent: 'flex-end' }}>
                            <button
                              className={`ap-btn ${isConfirming ? 'ap-btn--danger' : 'ap-btn--ghost'}`}
                              disabled={deleteLoading && isConfirming}
                              onClick={() => handleDeleteClick(r.review_id)}
                              onMouseLeave={() => {
                                // Reset confirm state if mouse leaves button
                                if (isConfirming) setConfirmDeleteId(null);
                              }}
                              title={isConfirming ? 'Click again to confirm delete' : 'Delete Review'}
                            >
                              {isConfirming ? (
                                <>
                                  <AlertTriangle size={14} />
                                  <span>Confirm?</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 size={14} />
                                  <span>Delete</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
