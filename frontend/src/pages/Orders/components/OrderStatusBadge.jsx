import React from 'react';
import { 
  Clock, 
  CheckCircle, 
  RefreshCw, 
  Truck, 
  AlertTriangle,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';
import './OrderStatusBadge.css';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    className: 'order-status-badge--pending',
    icon: Clock
  },
  confirmed: {
    label: 'Confirmed',
    className: 'order-status-badge--confirmed',
    icon: CheckCircle
  },
  processing: {
    label: 'Processing',
    className: 'order-status-badge--processing',
    icon: RefreshCw
  },
  shipped: {
    label: 'Shipped',
    className: 'order-status-badge--shipped',
    icon: Truck
  },
  delivered: {
    label: 'Delivered',
    className: 'order-status-badge--delivered',
    icon: CheckCircle2
  },
  cancelled: {
    label: 'Cancelled',
    className: 'order-status-badge--cancelled',
    icon: AlertTriangle
  },
  returned: {
    label: 'Returned',
    className: 'order-status-badge--returned',
    icon: RotateCcw
  }
};

export default function OrderStatusBadge({ status }) {
  const normalizedStatus = status?.toLowerCase() || 'pending';
  const config = STATUS_CONFIG[normalizedStatus] || {
    label: status || 'Pending',
    className: 'order-status-badge--pending',
    icon: Clock
  };

  const Icon = config.icon;

  return (
    <span className={`order-status-badge ${config.className}`}>
      <Icon size={12} className="order-status-badge__icon" />
      <span className="order-status-badge__label">{config.label}</span>
    </span>
  );
}
