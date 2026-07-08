import { Truck, ShieldCheck, RotateCcw } from 'lucide-react';
import './index.css';

const PERKS = [
  {
    icon: Truck,
    title: 'Free shipping on eligible products or orders above ₹1000',
    body: 'Fast delivery across India.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure payments',
    body: 'Multiple payment options including UPI and COD.',
  },
  {
    icon: RotateCcw,
    title: 'Easy returns',
    body: 'Not satisfied? We make returns hassle-free.',
  },
];

/**
 * PromoSection — static promotional strip with trust indicators.
 */
export function PromoSection() {
  return (
    <section className="promo-section" aria-label="Why shop with us">
      <div className="promo-section__grid">
        {PERKS.map(({ icon: Icon, title, body }) => (
          <div className="promo-section__item" key={title}>
            <div className="promo-section__icon-wrap" aria-hidden="true">
              <Icon size={24} />
            </div>
            <div>
              <p className="promo-section__title">{title}</p>
              <p className="promo-section__body">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
