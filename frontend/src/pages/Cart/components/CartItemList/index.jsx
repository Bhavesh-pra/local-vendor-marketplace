import { CartItemCard } from '../CartItemCard.jsx';
import './index.css';

/**
 * CartItemList — displays a list of cart items.
 *
 * @param {object[]} items  List of merged cart items
 * @param {function} onUpdateQuantity Callback to update item quantity
 * @param {function} onRemoveItem Callback to remove item
 * @param {function} onSaveForLater Callback to save item for later
 * @param {boolean} isSaving Indicates if save action is in progress
 */
export function CartItemList({ items, onUpdateQuantity, onRemoveItem, onSaveForLater, isSaving }) {
  return (
    <div className="cart-item-list">
      {items.map((item) => (
        <CartItemCard
          key={item.cart_item_id || item.product_id}
          item={item}
          onUpdateQuantity={onUpdateQuantity}
          onRemoveItem={onRemoveItem}
          onSaveForLater={onSaveForLater}
          isSaving={isSaving}
        />
      ))}
    </div>
  );
}
