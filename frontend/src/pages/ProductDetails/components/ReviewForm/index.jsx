import { useState, useEffect } from 'react';
import { StarRating } from '../../../../components/ui/StarRating/index.jsx';
import { InputField } from '../../../../components/ui/InputField/index.jsx';
import { Button } from '../../../../components/ui/Button/index.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { addReview, getReviewEligibility, uploadReviewMedia } from '../../../../services/reviewService.js';
import { validateRequired } from '../../../../utils/validators.js';
import { extractErrorMessage } from '../../../../utils/extractErrorMessage.js';
import { Spinner } from '../../../../components/ui/Spinner/index.jsx';
import { Camera, Trash2 } from 'lucide-react';
import './index.css';

/**
 * ReviewForm — form for customers to submit a product review if eligible.
 *
 * @param {number|string} productId
 * @param {Function}      onSubmitSuccess   Callback after successful submission
 */
export function ReviewForm({ productId, onSubmitSuccess }) {
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [orderItemId, setOrderItemId] = useState('');
  const [mediaUrls, setMediaUrls] = useState([]);
  
  const [eligible, setEligible] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const checkEligibility = async () => {
      try {
        setCheckingEligibility(true);
        const data = await getReviewEligibility(productId);
        setEligible(data.eligible);
        if (data.eligible && data.orderItems?.length > 0) {
          setOrderItems(data.orderItems);
          // Auto select if only one item available
          if (data.orderItems.length === 1) {
            setOrderItemId(data.orderItems[0].order_item_id.toString());
          }
        }
      } catch (err) {
        console.error('Failed to check review eligibility:', err.message);
        setEligible(false);
      } finally {
        setCheckingEligibility(false);
      }
    };

    if (productId) {
      checkEligibility();
    }
  }, [productId]);

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImage(true);
    for (const file of files) {
      // Client-side extension validation (strict image type verification)
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      if (!allowed.includes(ext)) {
        showToast('error', 'Only image files are allowed. Video uploads are forbidden.');
        continue;
      }

      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
        });
        reader.readAsDataURL(file);
        const base64Data = await base64Promise;

        const response = await uploadReviewMedia(file.name, base64Data);
        setMediaUrls((prev) => [...prev, response.fileUrl]);
        showToast('success', 'Image attached successfully');
      } catch (err) {
        showToast('error', extractErrorMessage(err, 'Failed to upload image'));
      }
    }
    setUploadingImage(false);
    // Clear input
    e.target.value = '';
  };

  const handleRemoveImage = (indexToRemove) => {
    setMediaUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const formErrors = {};
    if (!orderItemId) {
      formErrors.orderItemId = 'Please select a purchase order.';
    }
    if (rating === 0) {
      formErrors.rating = 'Please select a rating of at least 1 star.';
    }
    const titleError = validateRequired(title, 'Title');
    if (titleError) {
      formErrors.title = titleError;
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
        order_item_id: Number(orderItemId),
        rating,
        title: title.trim(),
        comment: comment.trim(),
        media_urls: mediaUrls
      });
      showToast('success', 'Thank you! Your review has been submitted.');
      setRating(0);
      setTitle('');
      setComment('');
      setMediaUrls([]);
      onSubmitSuccess?.();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to submit review.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingEligibility) {
    return (
      <div className="review-form-loading">
        <Spinner size="md" />
        <span>Verifying purchase history...</span>
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="review-form-ineligible">
        <p> Only verified buyers who ordered this product can write a review.</p>
        <p className="review-form-ineligible__subtext">You must have a delivered order for this product to leave feedback.</p>
      </div>
    );
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate>
      <h3 className="review-form__title">Write a Review</h3>

      {/* Order Item Selection */}
      {orderItems.length > 1 && (
        <div className="review-form__field">
          <label htmlFor="order-item-select" className="review-form__label">Select Purchase *</label>
          <select
            id="order-item-select"
            className="review-form__select"
            value={orderItemId}
            onChange={(e) => {
              setOrderItemId(e.target.value);
              setErrors((prev) => ({ ...prev, orderItemId: null }));
            }}
            disabled={submitting}
          >
            <option value="">Select which purchase you are reviewing</option>
            {orderItems.map((item) => (
              <option key={item.order_item_id} value={item.order_item_id}>
                Order #{item.order_number} (Delivered {new Date(item.delivered_at).toLocaleDateString()})
              </option>
            ))}
          </select>
          {errors.orderItemId && (
            <span className="review-form__error" role="alert">{errors.orderItemId}</span>
          )}
        </div>
      )}

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

      {/* Title Input */}
      <InputField
        id="review-title"
        label="Review Title *"
        placeholder="Summarize your experience..."
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setErrors((prev) => ({ ...prev, title: null }));
        }}
        error={errors.title}
        required
        disabled={submitting}
      />

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

      {/* Review Images Input */}
      <div className="review-form__field">
        <label className="review-form__label">Add Photos (Optional)</label>
        <div className="review-form__media-upload">
          <label htmlFor="review-image-input" className="review-form__file-label">
            <Camera size={16} />
            <span>Select Photos</span>
          </label>
          <input
            id="review-image-input"
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageChange}
            disabled={submitting || uploadingImage}
            style={{ display: 'none' }}
          />
          {uploadingImage && <Spinner size="sm" />}
        </div>

        {mediaUrls.length > 0 && (
          <div className="review-form__images-preview">
            {mediaUrls.map((url, idx) => (
              <div key={url} className="review-form__image-thumb">
                <img src={`${import.meta.env.VITE_API_BASE_URL || ''}${url}`} alt="Preview" />
                <button
                  type="button"
                  className="review-form__delete-image-btn"
                  onClick={() => handleRemoveImage(idx)}
                  aria-label="Remove image"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
