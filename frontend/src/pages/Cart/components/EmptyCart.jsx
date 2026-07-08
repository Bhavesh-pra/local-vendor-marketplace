import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { ROUTES } from '../../../constants/routes.js';
import './EmptyCart.css';

export function EmptyCart() {
  return (
    <div className="empty-cart">
      <div className="empty-cart__content">
        <div className="empty-cart__icon-circle">
          <ShoppingBag size={24} className="empty-cart__icon" />
        </div>
        <h2 className="empty-cart__heading">Your cart feels empty.</h2>
        <p className="empty-cart__subtext">Explore our products and find something you love!</p>
        <Link to={ROUTES.HOME} className="btn btn--primary empty-cart__cta">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
