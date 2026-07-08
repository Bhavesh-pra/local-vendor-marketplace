import React from 'react';
import { Link } from 'react-router-dom';
import './Breadcrumbs.css';

export default function Breadcrumbs({ category, productName }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs-container">
      <ol className="breadcrumbs-list">
        <li className="breadcrumbs-item">
          <Link to="/" className="breadcrumbs-link">Home</Link>
        </li>
        <li className="breadcrumbs-separator" aria-hidden="true">&gt;</li>
        {category && (
          <>
            <li className="breadcrumbs-item">
              <span className="breadcrumbs-text">{category}</span>
            </li>
            <li className="breadcrumbs-separator" aria-hidden="true">&gt;</li>
          </>
        )}
        <li className="breadcrumbs-item active" aria-current="page">
          <span className="breadcrumbs-text-active">{productName}</span>
        </li>
      </ol>
    </nav>
  );
}
