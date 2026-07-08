import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from '../../../components/ui/ImageWithFallback/index.jsx';
import { formatCurrency } from '../../../utils/formatters.js';
import { productPath } from '../../../constants/routes.js';
import './OrderItemsList.css';

export default function OrderItemsList({ items }) {
  return (
    <div className="order-items-list-card">
      <div className="order-items-list-card__title">
        <ShoppingBag size={16} />
        <span>Items Ordered</span>
      </div>

      <ul className="order-items-list-card__list">
        {items?.map((item) => {
          const hasVariants = item.size || (item.color && item.color !== 'Default' && item.color !== 'none');
          return (
            <li key={item.order_item_id || item.variant_id} className="order-items-list-card__item">
              <Link to={productPath(item.product_id)} className="order-items-list-card__thumb-link">
                <div className="order-items-list-card__thumb">
                  <ImageWithFallback src={item.image_url} alt={item.product_name} />
                </div>
              </Link>
              
              <div className="order-items-list-card__details">
                <Link to={productPath(item.product_id)} className="order-items-list-card__name-link">
                  <h4 className="order-items-list-card__item-name" title={item.product_name}>
                    {item.product_name}
                  </h4>
                </Link>
                <div className="order-items-list-card__item-meta">
                  <span className="order-items-list-card__meta-qty">Qty: {item.quantity}</span>
                  {hasVariants && (
                    <>
                      <span className="order-items-list-card__meta-divider">&bull;</span>
                      <span className="order-items-list-card__meta-variants">
                        {[item.size, item.color].filter(Boolean).join(' / ')}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="order-items-list-card__price-info">
                <span className="order-items-list-card__unit-price">
                  {formatCurrency(item.unit_price)} each
                </span>
                <span className="order-items-list-card__total-price">
                  {formatCurrency(item.quantity * item.unit_price)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
