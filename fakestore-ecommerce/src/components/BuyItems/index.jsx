import React, { useContext, useState } from 'react';
import ProductContext from "../../context/ProductContext";
import Header from '../Header';
import { useNavigate } from 'react-router-dom';

import './index.css';

const BuyItems = () => {
  const { productItemList } = useContext(ProductContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    paymentMethod: 'Cash',
    giftWrap: 'Normal',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const orderData = {
      ...formData,
      items: productItemList.map(({ id, title, price }) => ({ id, title, price })),
    };

    console.log('Order Data:', orderData); // Debug log

    try {
      const res = await fetch('http://localhost:3000/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (res.ok) {
        alert('Order placed successfully!');
        navigate('/order-success');
      }
    } catch (err) {
      alert('Order failed: ' + err.message);
      console.error('Order submission error:', err);
    }
  };

  return (
    <>
      <Header />
      <div className="buy-center-wrap">
        <div className="buy-card">
          <h1 className="buy-title">Buy All Products</h1>
          <form onSubmit={handleSubmit} className="buy-form">
            <label className="form-label">
              Name
              <input
                className="form-input"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter your name"
              />
            </label>

            <label className="form-label">
              Email
              <input
                className="form-input"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter your email"
              />
            </label>

            <label className="form-label">
              Address
              <textarea
                className="form-textarea"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                placeholder="Enter your address"
              />
            </label>

            <div className="radio-group">
              <div className="radio-title">Payment Method</div>
              <label className="radio-label">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="Cash"
                  checked={formData.paymentMethod === 'Cash'}
                  onChange={handleChange}
                  className="radio-input"
                />
                Cash on Delivery
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="UPI"
                  checked={formData.paymentMethod === 'UPI'}
                  onChange={handleChange}
                  className="radio-input"
                />
                UPI Payment
              </label>
              {formData.paymentMethod === 'UPI' && (
                <div className="upi-info">
                  <img src="/your-qr-code.png" alt="UPI QR code" className="upi-qr" />
                  <div className="upi-text">
                    Your order will be delivered once the payment is successful. If any problem, please
                    connect with us.
                  </div>
                </div>
              )}
            </div>

            <div className="radio-group">
              <div className="radio-title">Order type</div>
              <label className="radio-label">
                <input
                  type="radio"
                  name="giftWrap"
                  value="Normal"
                  checked={formData.giftWrap === 'Normal'}
                  onChange={handleChange}
                  className="radio-input"
                />
                Normal Order
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="giftWrap"
                  value="Gift"
                  checked={formData.giftWrap === 'Gift'}
                  onChange={handleChange}
                  className="radio-input"
                />
                Gift Wrap
              </label>
            </div>
            <button type="submit" className="submit-button">
              Place Your Order
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default BuyItems;
