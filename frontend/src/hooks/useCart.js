import { useCartContext } from '../context/CartContext.jsx';

/**
 * Convenience hook — subscribes to CartContext.
 * Exposes: cartId, itemCount, setCartId, setItemCount, incrementCount, resetCart.
 */
export function useCart() {
  return useCartContext();
}
