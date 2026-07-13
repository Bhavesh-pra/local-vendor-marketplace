import React from 'react';
import './TrustBadges.css';

export default function TrustBadges({ product }) {
  if (!product) return null;

  const { return_policy, trust_metrics, shipping } = product;

  // 1. Secure Payments (Static)
  const securePaymentsBadge = { icon: '🔒', title: 'Secure Checkout', desc: 'SSL encrypted payments' };

  // 2. Returns Trust (Dynamic from return policy)
  let returnsBadge = { icon: '🔄', title: 'Easy Returns', desc: 'Return policy applies' };
  if (return_policy) {
    if (return_policy.type === 'non_returnable') {
      returnsBadge = { icon: '✕', title: 'Non Returnable', desc: 'No returns allowed' };
    } else if (return_policy.type === 'replacement_only') {
      returnsBadge = { icon: '🔄', title: `${return_policy.days} Day Replacement`, desc: 'Product replacement eligible' };
    } else if (return_policy.type === 'returnable') {
      returnsBadge = { icon: '🔄', title: `${return_policy.days} Day Returns`, desc: 'Hassle-free returns' };
    }
  }

  // 3. Social Proof Trust (Dynamic from trust_metrics)
  let socialProofBadge = { icon: '🛡️', title: 'Trusted Store', desc: 'Buy with confidence' };
  if (trust_metrics) {
    const { purchases_count, rating_average, verified_reviews_count } = trust_metrics;
    if (purchases_count > 0) {
      socialProofBadge = {
        icon: '🛍️',
        title: `${purchases_count} Purchased`,
        desc: 'Real purchases completed'
      };
    } else if (verified_reviews_count > 0) {
      socialProofBadge = {
        icon: '⭐',
        title: `${rating_average ? rating_average.toFixed(1) : '0'} ★ Rating`,
        desc: `${verified_reviews_count} verified buyer reviews`
      };
    }
  }

  // 4. Shipping Trust (Dynamic from actual database capabilities)
  let shippingBadge = { icon: '🚚', title: 'Standard Delivery', desc: 'Secure packaging & shipping' };
  if (shipping) {
    if (shipping.free_shipping === 1) {
      shippingBadge = { icon: '🚚', title: 'Free Shipping', desc: 'Eligible for free shipping!' };
    } else if (shipping.cod_available === 1) {
      shippingBadge = { icon: '💵', title: 'Cash On Delivery', desc: 'COD available at checkout' };
    }
  }

  const badges = [
    securePaymentsBadge,
    returnsBadge,
    socialProofBadge,
    shippingBadge
  ];

  return (
    <div className="trust-badges-container">
      {badges.map((b, idx) => (
        <div key={idx} className="trust-badge-card">
          <span className="trust-badge-icon" role="img" aria-label={b.title}>{b.icon}</span>
          <div className="trust-badge-info">
            <span className="trust-badge-title">{b.title}</span>
            <span className="trust-badge-desc">{b.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
