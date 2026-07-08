import React, { useState } from 'react';
import { Mail, HelpCircle, Copy, Check } from 'lucide-react';
import './OrderSupportCard.css';

export default function OrderSupportCard() {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = (e) => {
    e.preventDefault();
    navigator.clipboard.writeText('support@shopcart.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="order-support-card">
      <h3 className="order-support-card__title">Need Help?</h3>
      <p className="order-support-card__subtitle">Questions about your order?</p>
      
      <div className="order-support-card__email-wrap">
        <Mail size={14} className="order-support-card__icon-mail" />
        <a href="mailto:support@shopcart.com" className="order-support-card__email">
          support@shopcart.com
        </a>
        <button 
          onClick={handleCopyEmail} 
          className="order-support-card__copy-btn"
          title="Copy email to clipboard"
          type="button"
        >
          {copied ? <Check size={12} style={{ color: 'var(--color-status-success, #10b981)' }} /> : <Copy size={12} />}
        </button>
      </div>

      <div className="order-support-card__actions">
        <a href="mailto:support@shopcart.com" className="btn btn--primary order-support-card__btn-contact">
          Contact Support
        </a>
        <button className="btn btn--outline order-support-card__btn-faq" disabled>
          <HelpCircle size={14} />
          <span>FAQ (Coming Soon)</span>
        </button>
      </div>
    </div>
  );
}
