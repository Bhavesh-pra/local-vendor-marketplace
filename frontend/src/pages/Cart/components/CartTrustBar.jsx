import React from 'react';
import { ShieldCheck, ArrowLeftRight, Truck, Award } from 'lucide-react';
import './CartTrustBar.css';

export function CartTrustBar() {
  return (
    <div className="cart-trust-bar">
      <div className="cart-trust-bar__item">
        <ShieldCheck size={14} className="cart-trust-bar__icon" />
        <span className="cart-trust-bar__text">Secure Payments</span>
      </div>
      <div className="cart-trust-bar__item">
        <ArrowLeftRight size={14} className="cart-trust-bar__icon" />
        <span className="cart-trust-bar__text">Easy Returns</span>
      </div>
      <div className="cart-trust-bar__item">
        <Truck size={14} className="cart-trust-bar__icon" />
        <span className="cart-trust-bar__text">Free Delivery</span>
      </div>
      <div className="cart-trust-bar__item">
        <Award size={14} className="cart-trust-bar__icon" />
        <span className="cart-trust-bar__text">Trusted Sellers</span>
      </div>
    </div>
  );
}
