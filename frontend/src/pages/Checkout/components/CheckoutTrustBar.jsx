import React from 'react';
import { ShieldCheck, Lock, CircleDollarSign, RotateCcw } from 'lucide-react';
import './CheckoutTrustBar.css';

export function CheckoutTrustBar() {
  const items = [
    { icon: ShieldCheck, label: 'Secure Checkout' },
    { icon: Lock, label: 'Encrypted Payment' },
    { icon: CircleDollarSign, label: 'No Hidden Charges' },
    { icon: RotateCcw, label: 'Easy Returns' },
  ];

  return (
    <div className="checkout-trust-bar">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={index} className="checkout-trust-bar__item">
            <Icon size={12} className="checkout-trust-bar__icon" />
            <span className="checkout-trust-bar__label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
