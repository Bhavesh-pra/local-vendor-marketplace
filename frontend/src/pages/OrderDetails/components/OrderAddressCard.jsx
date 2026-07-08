import React from 'react';
import { MapPin, Phone, Mail } from 'lucide-react';
import './OrderAddressCard.css';

export default function OrderAddressCard({ order }) {
  const {
    customer_name,
    customer_phone,
    customer_email,
    address_line_1
  } = order;

  return (
    <div className="order-address-card">
      <div className="order-address-card__title">
        <MapPin size={16} />
        <span>Shipping Information</span>
      </div>
      
      <div className="order-address-card__content">
        <h4 className="order-address-card__name">{customer_name}</h4>
        
        <p className="order-address-card__address">
          {address_line_1}
        </p>

        <div className="order-address-card__contact">
          {customer_phone && (
            <div className="order-address-card__contact-row">
              <Phone size={14} className="order-address-card__contact-icon" />
              <span>{customer_phone}</span>
            </div>
          )}
          <div className="order-address-card__contact-row">
            <Mail size={14} className="order-address-card__contact-icon" />
            <span>{customer_email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
