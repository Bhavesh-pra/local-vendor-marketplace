import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";

import { FaStar } from "react-icons/fa";

import Header from "../Header";
import ProductContext from "../../context/ProductContext";

import "./index.css";

const pageState = {
  initial: "INITIAL",
  processing: "PROCESSING",
  success: "SUCCESS",
  failed: "FAILED",
};

const ProductItemDetails = () => {
  const { id } = useParams();
  const [productDetails, setProductDetails] = useState({});
  const [activePageState, setActivePageState] = useState(pageState.initial);
  const [reviews, setReviews] = useState([]);
  const [showReviews, setShowReviews] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(0);
  const [reviewPostStatus, setReviewPostStatus] = useState('');

  const { productItemList, addItems, userId } = useContext(ProductContext);

  // Move getProductDetails outside useEffect for reuse
  const getProductDetails = async () => {
    setActivePageState(pageState.processing);
    try {
      const url = `http://localhost:3000/products/${id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status ${response.status}`);

      const data = await response.json();
      const updatedProduct = {
        id: data.product_id,
        title: data.product_name,
        price: data.cost_price,
        discountedPrice: data.selling_price,
        cost_price: data.cost_price,
        selling_price: data.selling_price,
        description: data.description,
        categoryName: data.category_name || '',
        productImages: Array.isArray(data.images) ? data.images : [],
        mainImage: data.image_url || '',
        creationAt: data.created_at || '',
        updatedAt: data.updated_at || '',
        rating: data.average_rating || 0,
        purchased: 0,
      };
      setProductDetails(updatedProduct);
      setActivePageState(pageState.success);
    } catch (error) {
      console.error('Error loading product:', error);
      setActivePageState(pageState.failed);
    }
  };

  useEffect(() => {
    getProductDetails();
  }, [id]);

  const fetchReviews = async () => {
    if (showReviews) {
      setShowReviews(false);
      return;
    }
    setShowReviews(true);
    try {
      const response = await fetch(`http://localhost:3000/reviews/${id}`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    }
  };

  const handleAddReview = async (e) => {
    e.preventDefault();
    const token = (() => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; jwt_token=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    })();

    if (!token) {
      setReviewPostStatus('You must be logged in to submit a review.');
      return;
    }

    if (!newComment.trim() || newRating < 1 || newRating > 5) {
      setReviewPostStatus('Please enter valid comment and rating (1-5).');
      return;
    }
    try {
      const reviewResponse = await fetch('http://localhost:3000/reviews/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: id,
          comment: newComment,
          rating: newRating
        }),
      });
      if (!reviewResponse.ok) {
        const errorText = await reviewResponse.text();
        setReviewPostStatus('Failed to post review: ' + errorText);
        return;
      }

      setReviewPostStatus('Review and rating added!');
      setNewComment('');
      setNewRating(0);

      // Refresh after post
      fetchReviews();
      getProductDetails();

    } catch (err) {
      setReviewPostStatus('Network error posting review.');
    }
  };

  const onClickAddItem = () => {
    addItems(productDetails);
  };

  const isAdded = productItemList.some(each => each.id === productDetails.id);
  const savedText = isAdded ? "Remove from Cart" : "Add to Cart";

  const {
    title,
    price,
    discountedPrice,
    description,
    categoryName,
    mainImage,
    creationAt,
    rating,
  } = productDetails;

  const renderStars = () => {
    const stars = [];
    const r = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <FaStar
          key={i}
          size={16}
          color={i <= r ? '#fbbc04' : '#ccc'}
          style={{ marginRight: 2 }}
        />
      );
    }
    return stars;
  };

  return (
    <div className="product-item-details-container">
      <div className="header-contaienr">
        <Header />
      </div>

      {activePageState === pageState.processing && <h1>Loading...</h1>}
      {activePageState === pageState.failed && (
        <div>
          <h1>Failed to load product details</h1>
        </div>
      )}
      {activePageState === pageState.success && (
        <div className="product-details-container">
          <div className="product-information-container">
            <div className="category-container">
              <p className="category-name">Category: {categoryName}</p>
            </div>
            <div className="review-container">
              <p className="rating">{renderStars()} ({rating.toFixed(1)})</p>
            </div>
            <hr />
          </div>

          <div className="description-container">
            <p className="description"><span className="description-word">Description:-</span> {description}</p>
            <p className="date">{new Date(creationAt).toLocaleDateString()}</p>
          </div>
          <hr />

          <div className="product">
            <div className="product-img-container">
              <img src={mainImage} alt="productImage" className="product-image" />
            </div>
            <div className="price-container">
              <p className="title">{title}</p>
              <p className="price">
                ₹ <span className="price-strike">{price}</span>
              </p>
              <p className="product-discounted-price">
                ₹ {discountedPrice}
              </p>
              <button type="button" className="add-to-cart-btn" onClick={onClickAddItem}>{savedText}</button>
            </div>
          </div>
          <hr />

          <button onClick={fetchReviews} className="toggle-reviews-btn">
            {showReviews ? 'Hide Reviews' : 'Show Reviews'}
          </button>

          {showReviews && (
            <div className="reviews-container">
              <h3>Reviews</h3>
              {reviews.length === 0 ? (
                <p>No reviews yet.</p>
              ) : (
                reviews.map(({ username, user_id, rating, comment, created_at }, index) => (
                  <div key={index} className="review-item">
                    <p><strong>{username || `User ${user_id}`} ({rating} ★):</strong> {comment}</p>
                    <p className="review-date">{new Date(created_at).toLocaleString()}</p>
                  </div>
                ))
              )}

              <div className="add-review-container">
                <h4>Add Review</h4>
                <form onSubmit={handleAddReview}>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write your review"
                    rows={3}
                    required
                  />
                  <div>
                    <label>Rating: </label>
                    <select value={newRating} onChange={e => setNewRating(Number(e.target.value))} required>
                      <option value={0}>Select rating</option>
                      {[1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n} Star{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit">Submit Review</button>
                </form>
                {reviewPostStatus && <p>{reviewPostStatus}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductItemDetails;
