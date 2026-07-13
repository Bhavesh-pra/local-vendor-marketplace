import React from 'react';
import './ReturnTimeline.css';

const getTimelineSteps = (requestType) => {
  return requestType === 'return'
    ? ['Requested', 'Approved', 'Pickup Scheduled', 'Picked Up', 'Received', 'Refunded', 'Completed']
    : ['Requested', 'Approved', 'Pickup Scheduled', 'Picked Up', 'Received', 'Replacement Shipped', 'Completed'];
};

const getStatusStepIndex = (status, requestType) => {
  if (status === 'REJECTED') return { index: 1, isRejected: true };

  const steps = requestType === 'return'
    ? ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REFUNDED', 'REFUND_COMPLETED']
    : ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REPLACEMENT_SHIPPED', 'REPLACEMENT_COMPLETED'];

  const idx = steps.indexOf(status);
  return { index: idx !== -1 ? idx : 0, isRejected: false };
};

export default function ReturnTimeline({ status, requestType, adminNotes }) {
  const { index: currentStepIndex, isRejected } = getStatusStepIndex(status, requestType);
  const steps = getTimelineSteps(requestType);

  return (
    <div className="return-timeline">
      <div className="return-timeline__header">
        <span className="return-timeline__status-badge">
          {requestType === 'return' ? 'Return' : 'Replacement'}:{' '}
          <strong className={isRejected ? 'text-danger' : 'text-primary'}>
            {status.replace('_', ' ')}
          </strong>
        </span>
      </div>

      <div className="return-timeline__steps-container">
        <ul className="return-timeline__steps">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isActive = idx === currentStepIndex && !isRejected;
            const isStepRejected = idx === 1 && isRejected;

            let stepClass = 'return-timeline__step--upcoming';
            if (isCompleted) stepClass = 'return-timeline__step--completed';
            else if (isActive) stepClass = 'return-timeline__step--active';
            else if (isStepRejected) stepClass = 'return-timeline__step--rejected';

            return (
              <li key={step} className={`return-timeline__step ${stepClass}`}>
                <div className="return-timeline__icon-wrapper">
                  <div className="return-timeline__step-indicator" />
                </div>
                <div className="return-timeline__step-content">
                  <span className="return-timeline__step-title">
                    {isStepRejected ? 'Rejected' : step}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {adminNotes && (
        <div className="return-timeline__notes">
          <span className="return-timeline__notes-label">Remarks:</span>
          <p className="return-timeline__notes-text">{adminNotes}</p>
        </div>
      )}
    </div>
  );
}
