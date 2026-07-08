import React from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { ROUTES } from '../../../constants/routes.js';
import './OrdersEmpty.css';

export default function OrdersEmpty() {
  return (
    <div className="orders-empty fade-in">
      <div className="orders-empty__icon-wrap">
        <Package size={36} className="orders-empty__icon" />
      </div>
      <h3 className="orders-empty__title">No orders yet</h3>
      <p className="orders-empty__desc">
        Start shopping and your purchases will appear here.
      </p>
      <Link to={ROUTES.HOME} className="btn btn--primary orders-empty__btn">
        Continue Shopping
      </Link>
    </div>
  );
}
