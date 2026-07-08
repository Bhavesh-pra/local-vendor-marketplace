import { useState } from 'react';
import { StarRating } from '../../../../components/ui/StarRating/index.jsx';
import { InputField } from '../../../../components/ui/InputField/index.jsx';
import { Button } from '../../../../components/ui/Button/index.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { addReview } from '../../../../services/reviewService.js';
import { validateRequired } from '../../../../utils/validators.js';
import { extractErrorMessage } from '../../../../utils/extractErrorMessage.js';
import './index.css';

/**
 * ReviewForm — form for customers to submit a product review.
 *
 * @param {number|string} productId
 * @param {Function}      onSubmitSuccess   Callback after successful submission
 */
export function ReviewForm({ productId, onSubmitSuccess }) {
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const formErrors = {};
    if (rating === 0) {
      formErrors.rating = 'Please select a rating of at least 1 star.';
    }
    const commentError = validateRequired(comment, 'Comment');
    if (commentError) {
      formErrors.comment = commentError;
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setSubmitting(true);
    try {
      await addReview({
        product_id: Number(productId),
        rating,
        comment: comment.trim(),
      });
      showToast('success', 'Thank you! Your review has been submitted.');
      setRating(0);
      setComment('');
      onSubmitSuccess?.();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to submit review.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate>
      <h3 className="review-form__title">Write a Review</h3>

      {/* Star Rating Field */}
      <div className="review-form__field">
        <label className="review-form__label">Your Rating *</label>
        <StarRating
          interactive={true}
          value={rating}
          onChange={(val) => {
            setRating(val);
            setErrors((prev) => ({ ...prev, rating: null }));
          }}
          label="Your Rating"
        />
        {errors.rating && (
          <span className="review-form__error" role="alert">
            {errors.rating}
          </span>
        )}
      </div>

      {/* Comment Input */}
      <InputField
        id="review-comment"
        label="Your Comments *"
        as="textarea"
        rows="4"
        placeholder="Share your experience with this product..."
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          setErrors((prev) => ({ ...prev, comment: null }));
        }}
        error={errors.comment}
        required
        disabled={submitting}
      />

      <Button
        type="submit"
        variant="primary"
        size="md"
        className="review-form__submit"
        loading={submitting}
      >
        Submit Review
      </Button>
    </form>
  );
}
