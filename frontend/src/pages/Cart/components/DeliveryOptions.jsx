import React, { useState } from 'react';
import { Truck, Zap, Store, MapPin } from 'lucide-react';
import './DeliveryOptions.css';

export function DeliveryOptions() {
  const [selectedOption, setSelectedOption] = useState('express');
  const [zipCode, setZipCode] = useState('10001');

  const options = [
    {
      id: 'standard',
      title: 'Standard delivery',
      desc: 'Arrives Jul 11 - Jul 14',
      price: 'Free',
      isFree: true,
      icon: Truck,
    },
    {
      id: 'express',
      title: 'Express delivery',
      desc: 'Arrives Jul 9 - Jul 10',
      price: '₹9.99',
      isFree: false,
      icon: Zap,
      badge: 'Popular',
    },
    {
      id: 'pickup',
      title: 'Store pickup',
      desc: 'Ready tomorrow, 10am',
      price: 'Free',
      isFree: true,
      icon: Store,
    },
  ];

  const handleSelect = (optionId) => {
    setSelectedOption(optionId);
  };

  const handleChangeZip = () => {
    const newZip = prompt('Enter delivery zip code:', zipCode);
    if (newZip && newZip.trim()) {
      setZipCode(newZip.trim());
    }
  };

  return (
    <div className="cart-delivery-options">
      <div className="cart-delivery-options__header">
        <div className="cart-delivery-options__title-area">
          <h3 className="cart-delivery-options__title">Delivery options</h3>
          <p className="cart-delivery-options__subtitle">Choose how you'd like to receive your order</p>
        </div>
        <div className="cart-delivery-options__location">
          <MapPin size={16} className="cart-delivery-options__pin-icon" />
          <span className="cart-delivery-options__zip">Deliver to <strong className="cart-delivery-options__zip-val">{zipCode}</strong></span>
          <button 
            type="button" 
            onClick={handleChangeZip}
            className="cart-delivery-options__change-btn"
          >
            Change
          </button>
        </div>
      </div>

      <div className="cart-delivery-options__grid">
        {options.map((opt) => {
          const IconComponent = opt.icon;
          const isSelected = selectedOption === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={`cart-delivery-card ${isSelected ? 'cart-delivery-card--active' : ''}`}
              onClick={() => handleSelect(opt.id)}
              aria-label={`Select ${opt.title} - ${opt.price}`}
            >
              {opt.badge && <span className="cart-delivery-card__badge">{opt.badge}</span>}
              <div className="cart-delivery-card__content">
                <div className="cart-delivery-card__icon-box">
                  <IconComponent size={20} className="cart-delivery-card__icon" />
                </div>
                <div className="cart-delivery-card__details">
                  <span className="cart-delivery-card__title">{opt.title}</span>
                  <span className="cart-delivery-card__desc">{opt.desc}</span>
                  <span className={`cart-delivery-card__price ${opt.isFree ? 'cart-delivery-card__price--free' : ''}`}>
                    {opt.price}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
