import { useState } from 'react';
import { Tag, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../../../../components/ui/Button/index.jsx';
import './index.css';

/**
 * CouponInput — lets the customer apply or remove a coupon code during checkout.
 *
 * All validation is backend-driven. This component never computes discounts.
 *
 * @param {function} onApply      Async callback(couponCode) → coupon result from backend
 * @param {function} onRemove     Callback() to clear the applied coupon
 * @param {object|null} appliedCoupon  The currently applied coupon result, or null
 * @param {boolean}  disabled     Whether the input is disabled (e.g., during order submission)
 */
export function CouponInput({ onApply, onRemove, appliedCoupon, disabled = false }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      await onApply(trimmed);
      setCode('');
    } catch (err) {
      setError(err.message || 'Failed to apply coupon');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setError(null);
    setCode('');
    onRemove();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  };

  // Applied state — show the green confirmation banner
  if (appliedCoupon) {
    return (
      <div className="coupon-input">
        <div className="coupon-input__applied">
          <div className="coupon-input__applied-left">
            <CheckCircle size={16} className="coupon-input__check-icon" />
            <span className="coupon-input__applied-code">{appliedCoupon.coupon_code}</span>
            <span className="coupon-input__applied-msg">{appliedCoupon.message}</span>
          </div>
          <button
            type="button"
            className="coupon-input__remove-btn"
            onClick={handleRemove}
            disabled={disabled}
            aria-label="Remove coupon"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Default state — input + apply button
  return (
    <div className="coupon-input">
      <label className="coupon-input__label">
        <Tag size={14} className="coupon-input__tag-icon" />
        Have a coupon code?
      </label>
      <div className="coupon-input__row">
        <input
          type="text"
          className="coupon-input__field"
          placeholder="Enter coupon code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          maxLength={30}
          aria-label="Coupon code"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="coupon-input__apply-btn"
          onClick={handleApply}
          disabled={disabled || loading || !code.trim()}
          loading={loading}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="coupon-input__spinner" />
              Validating
            </>
          ) : (
            'Apply'
          )}
        </Button>
      </div>
      {error && (
        <div className="coupon-input__error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
