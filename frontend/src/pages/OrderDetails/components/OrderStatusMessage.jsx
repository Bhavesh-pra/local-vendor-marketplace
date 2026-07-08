import React from 'react';
import { Clock, RefreshCw, Truck, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import './OrderStatusMessage.css';

const MESSAGE_CONFIG = {
  pending: {
    text: "Your order has been received and is awaiting confirmation.",
    icon: Clock,
    className: "order-status-message--pending"
  },
  confirmed: {
    text: "Your order is currently being prepared.",
    icon: RefreshCw,
    className: "order-status-message--processing"
  },
  processing: {
    text: "Your order is currently being prepared.",
    icon: RefreshCw,
    className: "order-status-message--processing"
  },
  shipped: {
    text: "Your package is on the way.",
    icon: Truck,
    className: "order-status-message--shipped"
  },
  delivered: {
    text: "Delivered successfully.",
    icon: CheckCircle2,
    className: "order-status-message--delivered"
  },
  cancelled: {
    text: "This order was cancelled.",
    icon: XCircle,
    className: "order-status-message--cancelled"
  },
  returned: {
    text: "This order has been returned.",
    icon: RotateCcw,
    className: "order-status-message--returned"
  }
};

export default function OrderStatusMessage({ status }) {
  const normalizedStatus = status?.toLowerCase() || 'pending';
  const config = MESSAGE_CONFIG[normalizedStatus] || MESSAGE_CONFIG.pending;
  const Icon = config.icon;

  return (
    <div className={`order-status-message ${config.className}`}>
      <Icon size={14} className="order-status-message__icon" />
      <span className="order-status-message__text">{config.text}</span>
    </div>
  );
}
