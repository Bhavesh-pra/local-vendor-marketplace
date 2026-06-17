import "./index.css";

const OrderSuccess = () => (
  <div className="order-success-container">
    <div className="order-success-card">
      <div className="success-icon">&#10004;</div>
      <h2 className="order-title">Order Placed Successfully!</h2>
      <p className="order-desc">
        Thank you for your order. A confirmation email has been sent.
      </p>
      <div className="order-info">
        <div className="info-section">
          <span className="info-label">Estimated Delivery:</span>
          <span className="info-value">Within 7-10 days</span>
        </div>
        <div className="info-section">
          <span className="info-label">Need help?</span>
          <span className="info-value">
            Email: <a href="mailto:support@myshop.com">support@myshop.com</a> <br />
            Call: <a href="tel:+919999999999">+91 99999 99999</a>
          </span>
        </div>
      </div>
      <div className="about-section">
        <h3>About Us</h3>
        <p>
          MyShop is dedicated to providing quality products with a customer-first approach, fast delivery, and secure payments. We’re here to assist you on every step of your shopping experience.
        </p>
      </div>
      <a className="back-btn" href="/">Go back to shop</a>
    </div>
  </div>
);

export default OrderSuccess;
