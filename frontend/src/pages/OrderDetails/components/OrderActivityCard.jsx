import React from 'react';
import { ShoppingBag, CheckCircle2, Box, Truck, XCircle, RotateCcw, Activity } from 'lucide-react';
import './OrderActivityCard.css';

const ICON_MAP = {
  placed: ShoppingBag,
  confirmed: CheckCircle2,
  processing: Box,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
  returned: RotateCcw
};

export default function OrderActivityCard({ events }) {
  const formatEventTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      
      const optionsDate = { month: 'short', day: 'numeric' };
      const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true };
      const datePart = date.toLocaleDateString('en-US', optionsDate);
      const timePart = date.toLocaleTimeString('en-US', optionsTime);
      return `${datePart}, ${timePart}`;
    } catch {
      return String(dateStr);
    }
  };

  const hasEvents = events && events.length > 0;

  return (
    <div className="order-activity-card">
      <div className="order-activity-card__title">
        <Activity size={16} />
        <span>Order Activity</span>
      </div>

      <div className="order-activity-card__content">
        {!hasEvents ? (
          <p className="order-activity-card__empty">No order updates yet.</p>
        ) : (
          <div className="order-activity-card__timeline">
            {events.map((event, idx) => {
              const statusKey = event.status?.toLowerCase() || 'placed';
              const IconComponent = ICON_MAP[statusKey] || ShoppingBag;

              return (
                <div key={idx} className="order-activity-card__event">
                  {/* Left Column: Icon and connector line */}
                  <div className="order-activity-card__event-indicator">
                    <div className={`order-activity-card__event-icon-wrap order-activity-card__event-icon-wrap--${statusKey}`}>
                      <IconComponent size={12} />
                    </div>
                    {idx < events.length - 1 && (
                      <div className="order-activity-card__event-connector"></div>
                    )}
                  </div>

                  {/* Right Column: Time and message details */}
                  <div className="order-activity-card__event-details">
                    <span className="order-activity-card__event-time">
                      {formatEventTime(event.created_at)}
                    </span>
                    <p className="order-activity-card__event-msg">
                      {event.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
