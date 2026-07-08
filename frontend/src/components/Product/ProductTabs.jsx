import React, { useState } from 'react';
import ShippingCard from './ShippingCard.jsx';
import WarrantyCard from './WarrantyCard.jsx';
import './ProductTabs.css';

export default function ProductTabs({ description, specifications = [], warranty, shipping }) {
  const [activeTab, setActiveTab] = useState('description');

  const tabs = [
    { id: 'description', label: 'Description' },
    { id: 'specifications', label: 'Specifications' },
    { id: 'warranty', label: 'Warranty & Policy' },
    { id: 'shipping', label: 'Shipping & Delivery' }
  ];

  return (
    <div className="product-tabs-container">
      <div className="tabs-header-strip">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-header-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-content-viewport">
        {activeTab === 'description' && (
          <div className="tab-pane-description fade-in">
            <p className="tab-description-text">{description || 'No description available for this product.'}</p>
          </div>
        )}

        {activeTab === 'specifications' && (
          <div className="tab-pane-specs fade-in">
            {specifications.length > 0 ? (
              <table className="specs-table">
                <tbody>
                  {specifications.map((spec, idx) => (
                    <tr key={idx} className="specs-row">
                      <td className="specs-cell name">{spec.name}</td>
                      <td className="specs-cell val">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="specs-empty">No specifications defined for this product.</p>
            )}
          </div>
        )}

        {activeTab === 'warranty' && (
          <div className="tab-pane-warranty fade-in">
            <WarrantyCard warranty={warranty} />
          </div>
        )}

        {activeTab === 'shipping' && (
          <div className="tab-pane-shipping fade-in">
            <ShippingCard shipping={shipping} />
          </div>
        )}
      </div>
    </div>
  );
}
