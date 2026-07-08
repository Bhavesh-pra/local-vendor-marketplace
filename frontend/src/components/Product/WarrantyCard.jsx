import React from 'react';
import './WarrantyCard.css';

export default function WarrantyCard({ warranty }) {
  if (!warranty) return <div className="warranty-card-empty">No warranty details specified.</div>;

  const { warranty_period, warranty_type, replacement_days, return_days, description } = warranty;

  return (
    <div className="warranty-card-container">
      <div className="warranty-metrics-grid">
        {warranty_period && (
          <div className="warranty-metric-item">
            <span className="metric-label">Warranty Period</span>
            <span className="metric-val">{warranty_period}</span>
          </div>
        )}
        {warranty_type && (
          <div className="warranty-metric-item">
            <span className="metric-label">Warranty Type</span>
            <span className="metric-val">{warranty_type}</span>
          </div>
        )}
        {replacement_days > 0 && (
          <div className="warranty-metric-item">
            <span className="metric-label">Replacement Window</span>
            <span className="metric-val">{replacement_days} Days</span>
          </div>
        )}
        {return_days > 0 && (
          <div className="warranty-metric-item">
            <span className="metric-label">Return Window</span>
            <span className="metric-val">{return_days} Days</span>
          </div>
        )}
      </div>

      {description && (
        <div className="warranty-description-box">
          <h5 className="description-title">Warranty Coverage Description</h5>
          <p className="description-text">{description}</p>
        </div>
      )}
    </div>
  );
}
