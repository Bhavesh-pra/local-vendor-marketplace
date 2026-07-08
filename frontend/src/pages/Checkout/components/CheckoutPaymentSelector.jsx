import React from 'react';
import { Landmark, Smartphone, CreditCard } from 'lucide-react';
import './CheckoutPaymentSelector.css';

export function CheckoutPaymentSelector({ selectedMethod, onChange }) {
  const options = [
    {
      id: 'COD',
      label: 'Cash on Delivery (COD)',
      description: 'Pay with cash or UPI upon delivery',
      icon: Landmark,
      enabled: true
    },
    {
      id: 'UPI',
      label: 'UPI / Net Banking',
      description: 'Pay instantly using any UPI app',
      icon: Smartphone,
      enabled: false,
      badge: 'Coming Soon'
    },
    {
      id: 'CARD',
      label: 'Debit / Credit Card',
      description: 'Visa, Mastercard, RuPay & Maestro',
      icon: CreditCard,
      enabled: false,
      badge: 'Coming Soon'
    }
  ];

  return (
    <div className="checkout-payment-selector">
      <div className="checkout-payment-selector__header">
        <h4 className="checkout-payment-selector__title">Payment Method</h4>
      </div>

      <div className="checkout-payment-selector__grid">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = opt.id === selectedMethod;
          return (
            <div
              key={opt.id}
              className={`checkout-payment-selector__tile ${isSelected ? 'checkout-payment-selector__tile--selected' : ''} ${!opt.enabled ? 'checkout-payment-selector__tile--disabled' : ''}`}
              onClick={() => opt.enabled && onChange(opt.id)}
            >
              <div className="checkout-payment-selector__icon-wrap">
                <Icon size={20} className="checkout-payment-selector__icon" />
              </div>
              <div className="checkout-payment-selector__info">
                <div className="checkout-payment-selector__row">
                  <span className="checkout-payment-selector__label">{opt.label}</span>
                  {opt.badge && (
                    <span className="checkout-payment-selector__badge">{opt.badge}</span>
                  )}
                </div>
                <span className="checkout-payment-selector__desc">{opt.description}</span>
              </div>
              {opt.enabled && (
                <div className="checkout-payment-selector__radio">
                  <div className={`checkout-payment-selector__radio-inner ${isSelected ? 'checkout-payment-selector__radio-inner--active' : ''}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default CheckoutPaymentSelector;
