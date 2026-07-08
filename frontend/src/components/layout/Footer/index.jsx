import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes.js';
import './index.css';

/**
 * Footer — minimal brand footer.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__inner container">
        <div className="footer__brand">
          <span className="footer__logo-icon" aria-hidden="true">🛍</span>
          <div>
            <p className="footer__brand-name">ShopCart</p>
            <p className="footer__tagline">Quality products, delivered fast.</p>
          </div>
        </div>

        <nav className="footer__nav" aria-label="Footer navigation">
          <Link to={ROUTES.HOME} className="footer__link">Shop</Link>
          <Link to={ROUTES.CART} className="footer__link">Cart</Link>
          <Link to={ROUTES.ORDERS} className="footer__link">Orders</Link>
          <Link to={ROUTES.LOGIN} className="footer__link">Login</Link>
        </nav>

        <p className="footer__copy">
          © {year} ShopCart. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
