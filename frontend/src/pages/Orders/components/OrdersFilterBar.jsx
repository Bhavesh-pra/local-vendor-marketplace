import React from 'react';
import './OrdersFilterBar.css';

export default function OrdersFilterBar({ activeFilter, onFilterChange, counts }) {
  const tabs = [
    { key: 'all', label: 'All Orders' },
    { key: 'active', label: 'Active Orders' },
    { key: 'delivered', label: 'Delivered Orders' },
    { key: 'cancelled', label: 'Cancelled Orders' }
  ];

  return (
    <div className="orders-filter-bar">
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.key;
        const count = counts[tab.key] || 0;
        return (
          <button
            key={tab.key}
            onClick={() => onFilterChange(tab.key)}
            className={`orders-filter-bar__tab ${isActive ? 'orders-filter-bar__tab--active' : ''}`}
            aria-selected={isActive}
            role="tab"
          >
            <span className="orders-filter-bar__label">{tab.label}</span>
            <span className="orders-filter-bar__count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
