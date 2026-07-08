import React from 'react';
import './TrustBadges.css';

export default function TrustBadges() {
  const badges = [
    { icon: '🔒', title: 'Secure Payments', desc: 'SSL Encrypted Checkout' },
    { icon: '🚚', title: 'Free Shipping', desc: 'Eligible products or orders above ₹1000' },
    { icon: '🛡️', title: 'Warranty Included', desc: 'Genuine Brand Cover' },
    { icon: '🔄', title: 'Easy Returns', desc: '7-Day Return/Replace' }
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
