import React from 'react';
import { Bell, CheckCircle2, Info } from 'lucide-react';
import './OrderUpdatesCard.css';

export default function OrderUpdatesCard() {
  return (
    <div className="order-updates-card">
      <div className="order-updates-card__title">
        <Bell size={16} />
        <span>Order Updates</span>
      </div>

      <div className="order-updates-card__content">
        <div className="order-updates-card__row">
          <CheckCircle2 size={14} className="order-updates-card__check-icon" />
          <span className="order-updates-card__text">Status changes appear here.</span>
        </div>
        <div className="order-updates-card__row">
          <CheckCircle2 size={14} className="order-updates-card__check-icon" />
          <span className="order-updates-card__text">You'll receive notifications for important order updates.</span>
        </div>
        <div className="order-updates-card__info-row">
          <Info size={12} className="order-updates-card__info-icon" />
          <span className="order-updates-card__info-text">Future support: Email, SMS, Push notifications.</span>
        </div>
      </div>
    </div>
  );
}
