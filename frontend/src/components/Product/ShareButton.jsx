import React, { useState } from 'react';
import './ShareButton.css';

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <div className="share-button-wrapper">
      <button className="share-btn" onClick={handleShare} aria-label="Share product link">
        <span className="share-icon">🔗</span>
        <span className="share-text">Share Link</span>
      </button>
      {copied && <span className="share-tooltip">Copied!</span>}
    </div>
  );
}
