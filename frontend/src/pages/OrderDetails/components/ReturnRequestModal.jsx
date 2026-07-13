import React, { useState } from 'react';
import { X } from 'lucide-react';
import { submitReturnRequest } from '../../../services/orderService.js';
import { useToast } from '../../../hooks/useToast.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import './ReturnRequestModal.css';

const REASONS = [
  { code: 'DAMAGED_ITEM', label: 'Damaged Item' },
  { code: 'WRONG_ITEM_RECEIVED', label: 'Wrong Item Received' },
  { code: 'MISSING_PARTS', label: 'Missing Parts' },
  { code: 'NOT_AS_DESCRIBED', label: 'Not as Described' },
  { code: 'QUALITY_ISSUE', label: 'Quality Issue' },
  { code: 'SIZE_ISSUE', label: 'Size/Fit Issue' },
  { code: 'CHANGED_MIND', label: 'Changed Mind' },
  { code: 'OTHER', label: 'Other' }
];

export default function ReturnRequestModal({ isOpen, onClose, orderId, variantId, requestType, productName, onSubmitted }) {
  const { showToast } = useToast();
  const [reasonCode, setReasonCode] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reasonCode) {
      showToast('error', 'Please select a reason code');
      return;
    }

    setSubmitting(true);
    try {
      await submitReturnRequest(orderId, variantId, {
        request_type: requestType,
        reason_code: reasonCode,
        reason_description: description.trim()
      });
      showToast('success', `${requestType === 'return' ? 'Return' : 'Replacement'} request submitted successfully!`);
      onSubmitted();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit request';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const titleText = requestType === 'return' ? 'Request Return' : 'Request Replacement';

  return (
    <div className="return-modal-overlay" role="dialog" aria-modal="true">
      <div className="return-modal-container">
        <header className="return-modal-header">
          <h3 className="return-modal-title">{titleText}</h3>
          <button className="return-modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="return-modal-form">
          <p className="return-modal-product-name">
            Item: <strong>{productName}</strong>
          </p>

          <div className="return-modal-field">
            <label htmlFor="reason-code" className="return-modal-label">Reason *</label>
            <select
              id="reason-code"
              className="return-modal-select"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              required
            >
              <option value="">Select a reason</option>
              {REASONS.map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="return-modal-field">
            <label htmlFor="reason-description" className="return-modal-label">Additional Comments (Optional)</label>
            <textarea
              id="reason-description"
              className="return-modal-textarea"
              placeholder="Provide context or description for this request..."
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <footer className="return-modal-footer">
            <button
              type="button"
              className="return-modal-btn return-modal-btn--secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="return-modal-btn return-modal-btn--primary"
              disabled={submitting}
            >
              {submitting ? <Spinner size="sm" /> : 'Submit Request'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
