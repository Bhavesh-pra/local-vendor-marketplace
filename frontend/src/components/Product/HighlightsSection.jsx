import React from 'react';
import './HighlightsSection.css';

export default function HighlightsSection({ specifications }) {
  // Filter specifications that are marked as highlights
  const highlights = specifications?.filter(spec => spec.is_highlight === 1) || [];

  if (highlights.length === 0) {
    // If no explicit highlights exist, fallback to the first 3 specifications as highlights
    const fallback = specifications?.slice(0, 3) || [];
    if (fallback.length === 0) return null;
    return (
      <div className="highlights-container">
        <ul className="highlights-list">
          {fallback.map((hl, idx) => (
            <li key={idx} className="highlights-item">
              <span className="highlights-bullet">✓</span>
              <span className="highlights-label">{hl.name}:</span>
              <span className="highlights-val">{hl.value}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="highlights-container">
      <ul className="highlights-list">
        {highlights.map((hl, idx) => (
          <li key={idx} className="highlights-item">
            <span className="highlights-bullet">✓</span>
            <span className="highlights-label">{hl.name}:</span>
            <span className="highlights-val">{hl.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
