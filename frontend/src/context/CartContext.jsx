import { createContext, useContext, useState, useMemo, useCallback } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cartId, setCartIdState] = useState(null);
  const [itemCount, setItemCountState] = useState(0);

  const setCartId = useCallback((id) => {
    setCartIdState(id ?? null);
  }, []);

  const setItemCount = useCallback((n) => {
    setItemCountState(typeof n === 'number' ? n : 0);
  }, []);

  const incrementCount = useCallback((n = 1) => {
    setItemCountState((prev) => prev + n);
  }, []);

  const resetCart = useCallback(() => {
    setCartIdState(null);
    setItemCountState(0);
  }, []);

  const value = useMemo(
    () => ({ cartId, itemCount, setCartId, setItemCount, incrementCount, resetCart }),
    [cartId, itemCount, setCartId, setItemCount, incrementCount, resetCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCartContext must be used inside <CartProvider>');
  return ctx;
}
