import { Check } from 'lucide-react';
import heroImage from '../../../assets/images/hero.jpg';
import './index.css';

/**
 * Hero — premium editorial banner on the Home page.
 * Displays a two-column layout on desktop, stacking on mobile.
 * Wraps in a CSS Grid wrapper to transition natural height collapses smoothly.
 */
export function Hero({ isVisible }) {
  return (
    <div className={`hero-wrapper ${!isVisible ? 'hero-wrapper--hidden' : ''}`}>
      <div className="hero-wrapper-inner">
        <section className="hero" aria-label="Featured Collection">
          <div className="hero__container">
            
            {/* Left Column (Heading + Eyebrow) */}
            <div className="hero__content-left">
              <p className="hero__eyebrow">Curated Collection</p>
              <h1 className="hero__heading">
                <span className="hero__heading-line">Discover Products</span>
                <span className="hero__heading-line hero__heading-highlight">Worth Owning.</span>
              </h1>
            </div>

            {/* Middle Column (Actions, Trust Badges, Description) */}
            <div className="hero__content-middle">
              <div className="hero__actions">
                <a href="#products" className="hero__btn-primary">
                  Explore Collection
                </a>
                <a href="#products" className="hero__btn-secondary">
                  Browse Products <span className="hero__btn-arrow">→</span>
                </a>
              </div>
              <div className="hero__trust-strip">
                <span className="hero__trust-item">
                  <Check size={14} className="hero__trust-icon" aria-hidden="true" />
                  <span>Secure Checkout</span>
                </span>
                <span className="hero__trust-item">
                  <Check size={14} className="hero__trust-icon" aria-hidden="true" />
                  <span>Premium Quality</span>
                </span>
                <span className="hero__trust-item">
                  <Check size={14} className="hero__trust-icon" aria-hidden="true" />
                  <span>Fast Delivery</span>
                </span>
              </div>
              <p className="hero__description">
                Explore premium essentials across fashion, technology, and everyday lifestyle with a shopping experience crafted for modern users.
              </p>
            </div>

            {/* Right Column (Visual) */}
            <div className="hero__visual-container">
              <div className="hero__visual">
                <img 
                  src={heroImage} 
                  alt="Premium lifestyle essentials collection including white sneakers, watches, electronics, and accessories" 
                  className="hero__image" 
                  loading="eager"
                />
              </div>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
}
