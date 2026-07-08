import React from 'react';
import { ShieldCheck, RotateCcw, Award, ShieldAlert } from 'lucide-react';
import './CheckoutTrustBar.css';

export function CheckoutTrustBar() {
  const items = [
    { icon: ShieldCheck, label: 'Secure Checkout' },
    { icon: RotateCcw, label: 'Easy Returns' },
    { icon: Award, label: 'Trusted Sellers' },
    { icon: ShieldAlert, label: 'Order Protection' },
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
