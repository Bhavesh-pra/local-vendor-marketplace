import React, { useState } from 'react';
import './ShippingCard.css';

export default function ShippingCard({ shipping }) {
  const [pincode, setPincode] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState('');

  if (!shipping) return <div className="shipping-card-empty">No shipping details specified.</div>;

  const { weight, length, width, height, shipping_class, cod_available, free_shipping } = shipping;

  const handleCheck = (e) => {
    e.preventDefault();
    setError('');
    setEstimate(null);

    const cleanPin = pincode.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      setError('Please enter a valid 6-digit pincode');
      return;
    }

    // Static delivery calculation based on pincode ranges
    const dayOffset = (parseInt(cleanPin.slice(0, 2), 10) % 3) + 2; // e.g. 2 to 4 days
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + dayOffset);
    const dateString = deliveryDate.toLocaleDateString('en-US', options);

    setEstimate({
      date: dateString,
      days: dayOffset,
      isFree: free_shipping === 1 || free_shipping === true,
      cod: cod_available === 1 || cod_available === true
    });
  };

  return (
    <div className="shipping-card-container">
      <div className="shipping-specs-grid">
        {weight && (
          <div className="shipping-spec-item">
            <span className="spec-label">Weight</span>
            <span className="spec-val">{weight} kg</span>
          </div>
        )}
        {(length || width || height) && (
          <div className="shipping-spec-item">
            <span className="spec-label">Dimensions</span>
            <span className="spec-val">
              {[length, width, height].filter(Boolean).join(' × ')} cm
            </span>
          </div>
        )}
        {shipping_class && (
          <div className="shipping-spec-item">
            <span className="spec-label">Shipping Class</span>
            <span className="spec-val">{shipping_class}</span>
          </div>
        )}
      </div>

      {/* Delivery Charges Policy */}
      <div className="shipping-policy-box">
        <h4 className="shipping-policy-title">Delivery Charges</h4>
        <ul className="shipping-policy-list">
          <li><span className="shipping-policy-range">Below ₹500</span><span className="shipping-policy-fee">₹80</span></li>
          <li><span className="shipping-policy-range">₹500 – ₹799</span><span className="shipping-policy-fee">₹50</span></li>
          <li><span className="shipping-policy-range">₹800 – ₹999</span><span className="shipping-policy-fee">₹20</span></li>
          <li><span className="shipping-policy-range">₹1000 and above</span><span className="shipping-policy-fee shipping-policy-fee--free">FREE</span></li>
        </ul>
        {(free_shipping === 1 || free_shipping === true) && (
          <p className="shipping-policy-note shipping-policy-note--free">
            ✓ This product ships free regardless of order value.
          </p>
        )}
        {!(free_shipping === 1 || free_shipping === true) && (
          <p className="shipping-policy-note">
            Products marked "Free Delivery" always ship free regardless of order value.
          </p>
        )}
      </div>

      <div className="shipping-estimator-box">
        <h4 className="estimator-title">Delivery Estimation</h4>
        <form onSubmit={handleCheck} className="estimator-form">
          <input
            type="text"
            className="estimator-input"
            placeholder="Enter 6-digit pincode"
            value={pincode}
            maxLength={6}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" className="estimator-btn">Check</button>
        </form>

        {error && <div className="estimator-error">{error}</div>}

        {estimate && (
          <div className="estimator-result fade-in">
            <div className="result-row">
              <span className="result-icon">🚚</span>
              <div>
                <p className="result-text">
                  Delivery by <strong className="highlight-date">{estimate.date}</strong> ({estimate.days} days)
                </p>
                <p className="result-subtext">
                  {estimate.isFree ? 'Free Shipping Available' : 'Standard Shipping rates apply'}
                </p>
              </div>
            </div>
            <div className="result-row">
              <span className="result-icon">{estimate.cod ? '💵' : '🚫'}</span>
              <div>
                <p className="result-text">
                  {estimate.cod ? 'Cash on Delivery Available' : 'Cash on Delivery Unavailable'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
