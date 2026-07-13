import React, { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from '../../../components/ui/ImageWithFallback/index.jsx';
import { formatCurrency } from '../../../utils/formatters.js';
import { productPath } from '../../../constants/routes.js';
import ReturnRequestModal from './ReturnRequestModal.jsx';
import ReturnTimeline from './ReturnTimeline.jsx';
import './OrderItemsList.css';

export default function OrderItemsList({ items, orderId, onRefresh }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [requestType, setRequestType] = useState('return');

  const handleInitiateRequest = (item, type) => {
    setActiveItem(item);
    setRequestType(type);
    setModalOpen(true);
  };
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
                {item.return_eligibility && (
                  <div className="order-items-list-card__eligibility">
                    <span className={`order-items-list-card__eligibility-text ${
                      item.return_eligibility.status === 'RETURN_ELIGIBLE' || item.return_eligibility.status === 'REPLACEMENT_ELIGIBLE'
                        ? 'text-success'
                        : item.return_eligibility.status === 'DELIVERY_DATE_MISSING'
                          ? 'text-danger'
                          : 'text-muted'
                    }`}>
                      {item.return_eligibility.message}
                    </span>

                    {/* Return Action Trigger Buttons */}
                    {item.return_eligibility.status === 'RETURN_ELIGIBLE' && (
                      <div className="order-items-list-card__actions">
                        <button
                          className="order-items-list-card__action-btn"
                          onClick={() => handleInitiateRequest(item, 'return')}
                        >
                          Request Return
                        </button>
                        <button
                          className="order-items-list-card__action-btn"
                          onClick={() => handleInitiateRequest(item, 'replacement')}
                        >
                          Request Replacement
                        </button>
                      </div>
                    )}

                    {item.return_eligibility.status === 'REPLACEMENT_ELIGIBLE' && (
                      <div className="order-items-list-card__actions">
                        <button
                          className="order-items-list-card__action-btn"
                          onClick={() => handleInitiateRequest(item, 'replacement')}
                        >
                          Request Replacement
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline UI for active returns */}
                {item.return_eligibility?.status === 'REQUEST_EXISTS' && item.return_eligibility.return_request && (
                  <ReturnTimeline
                    status={item.return_eligibility.return_request.status}
                    requestType={item.return_eligibility.return_request.request_type}
                    adminNotes={item.return_eligibility.return_request.admin_notes}
                  />
                )}
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

      {activeItem && (
        <ReturnRequestModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setActiveItem(null);
          }}
          orderId={orderId}
          variantId={activeItem.variant_id}
          requestType={requestType}
          productName={activeItem.product_name}
          onSubmitted={onRefresh}
        />
      )}
    </div>
  );
}
