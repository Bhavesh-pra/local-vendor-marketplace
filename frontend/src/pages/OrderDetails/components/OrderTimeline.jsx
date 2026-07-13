import React from 'react';
import { ShoppingBag, Box, Truck, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import './OrderTimeline.css';

const ACTIVE_STEPS_MAP = {
  pending: 1,
  confirmed: 2,
  processing: 2,
  shipped: 3,
  delivered: 4,
  cancelled: -1,
  returned: -2
};

export default function OrderTimeline({ status }) {
  const currentStatus = status?.toLowerCase() || 'pending';
  const activeStep = ACTIVE_STEPS_MAP[currentStatus] || 1;

  if (currentStatus === 'cancelled') {
    return (
      <div className="order-timeline-widget">
        <h4 className="order-timeline-widget__title">Order Status</h4>
        <div className="order-timeline-widget__steps-container">
          <div className="order-timeline-widget__steps order-timeline-widget__steps--cancelled">
            <div className="order-timeline-widget__step order-timeline-widget__step--completed">
              <div className="order-timeline-widget__icon-wrap">
                <CheckCircle2 size={16} />
              </div>
              <span className="order-timeline-widget__label">Order Placed</span>
            </div>
            <div className="order-timeline-widget__connector order-timeline-widget__connector--cancelled"></div>
            <div className="order-timeline-widget__step order-timeline-widget__step--cancelled">
              <div className="order-timeline-widget__icon-wrap">
                <XCircle size={16} />
              </div>
              <span className="order-timeline-widget__label">Cancelled</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStatus === 'returned') {
    return (
      <div className="order-timeline-widget">
        <h4 className="order-timeline-widget__title">Order Status</h4>
        <div className="order-timeline-widget__steps-container">
          <div className="order-timeline-widget__steps order-timeline-widget__steps--returned">
            <div className="order-timeline-widget__step order-timeline-widget__step--completed">
              <div className="order-timeline-widget__icon-wrap">
                <CheckCircle2 size={16} />
              </div>
              <span className="order-timeline-widget__label">Order Placed</span>
            </div>
            <div className="order-timeline-widget__connector order-timeline-widget__connector--returned"></div>
            <div className="order-timeline-widget__step order-timeline-widget__step--returned">
              <div className="order-timeline-widget__icon-wrap">
                <RotateCcw size={16} />
              </div>
              <span className="order-timeline-widget__label">Returned</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { label: 'Order Placed', icon: ShoppingBag, level: 1 },
    { label: 'Order Confirmed', icon: Box, level: 2 },
    { label: 'Order Shipped', icon: Truck, level: 3 },
    { label: 'Delivered', icon: CheckCircle2, level: 4 }
  ];

  return (
    <div className="order-timeline-widget">
      <h4 className="order-timeline-widget__title">Order Status</h4>
      <div className="order-timeline-widget__steps-container">
        <div className="order-timeline-widget__steps">
          {steps.map((step, idx) => {
            const isCompleted = activeStep > step.level;
            const isActive = activeStep === step.level;
            const isUpcoming = activeStep < step.level;
            const Icon = step.icon;

            let stepClass = 'order-timeline-widget__step--upcoming';
            if (isCompleted) stepClass = 'order-timeline-widget__step--completed';
            if (isActive) stepClass = 'order-timeline-widget__step--active';

            return (
              <React.Fragment key={idx}>
                <div className={`order-timeline-widget__step ${stepClass}`}>
                  <div className="order-timeline-widget__icon-wrap">
                    <Icon size={16} />
                  </div>
                  <span className="order-timeline-widget__label">{step.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`order-timeline-widget__connector 
                    ${isCompleted ? 'order-timeline-widget__connector--completed' : ''}`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
