import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './CancelOrderModal.css';

export default function CancelOrderModal({ isOpen, onClose, onConfirm, isCancelling }) {
  if (!isOpen) return null;

  return (
    <div className="cancel-order-modal-overlay" onClick={onClose}>
      <div className="cancel-order-modal-card" onClick={(e) => e.stopPropagation()}>
        <button 
          className="cancel-order-modal-card__close-btn" 
          onClick={onClose} 
          aria-label="Close modal"
          disabled={isCancelling}
          type="button"
        >
          <X size={18} />
        </button>

        <div className="cancel-order-modal-card__icon-wrap">
          <AlertTriangle size={32} />
        </div>

        <h3 className="cancel-order-modal-card__title">
          Are you sure you want to cancel this order?
        </h3>
        <p className="cancel-order-modal-card__desc">
          This action cannot be undone.
        </p>

        <div className="cancel-order-modal-card__actions">
          <button 
            type="button" 
            className="btn btn--outline cancel-order-modal-card__btn-keep" 
            onClick={onClose}
            disabled={isCancelling}
          >
            Keep Order
          </button>
          <button 
            type="button" 
            className="btn btn--danger cancel-order-modal-card__btn-cancel" 
            onClick={onConfirm}
            disabled={isCancelling}
          >
            {isCancelling ? 'Cancelling...' : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
