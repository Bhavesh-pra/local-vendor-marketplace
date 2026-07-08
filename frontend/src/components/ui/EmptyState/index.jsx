import { ShoppingCart } from 'lucide-react';
import { Button } from '../Button/index.jsx';
import './index.css';

/**
 * EmptyState — informational placeholder for empty data sets.
 *
 * @param {import('react').ElementType} [icon]     Lucide icon component
 * @param {string}                      heading
 * @param {string}                      [body]
 * @param {{ label: string, onClick?: Function, href?: string }} [action]
 */
export function EmptyState({ icon: Icon = ShoppingCart, heading, body, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon-wrap" aria-hidden="true">
        <Icon size={40} />
      </div>
      <h3 className="empty-state__heading">{heading}</h3>
      {body && <p className="empty-state__body">{body}</p>}
      {action && (
        action.href
          ? <a href={action.href} className="btn btn--primary btn--md empty-state__action">{action.label}</a>
          : <Button variant="primary" onClick={action.onClick} className="empty-state__action">{action.label}</Button>
      )}
    </div>
  );
}
