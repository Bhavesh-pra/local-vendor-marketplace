import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { CartItemList } from './components/CartItemList/index.jsx';
import { CartSummary } from './components/CartSummary/index.jsx';
import { DeliveryOptions } from './components/DeliveryOptions.jsx';
import { Spinner } from '../../components/ui/Spinner/index.jsx';
import { ErrorState } from '../../components/ui/ErrorState/index.jsx';
import { SaveForLater } from './components/SaveForLater.jsx';
import { CartRecommendations } from './components/CartRecommendations.jsx';
import { EmptyCart } from './components/EmptyCart.jsx';
import { StickyCheckoutBar } from './components/StickyCheckoutBar.jsx';
import { useCart } from '../../hooks/useCart.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { ROUTES } from '../../constants/routes.js';
import {
  getCarts,
  getCartItemsById,
  updateCartItem,
  deleteCartItem,
  getSavedItems,
  saveItem,
  deleteSavedItem,
  moveSavedItemToCart,
  createCart,
  addCartItem
} from '../../services/cartService.js';
import { getProducts } from '../../services/productService.js';
import { extractErrorMessage } from '../../utils/extractErrorMessage.js';
import './index.css';

/**
 * Cart page — orchestrates fetching the active cart, loading its items,
 * loading saved for later items, and coordinating cart operations.
 */
export default function Cart() {
  useDocumentTitle('Your Cart');

  const { cartId, setCartId, setItemCount } = useCart();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  // Data states
  const [items, setItems] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isDeletingSaved, setIsDeletingSaved] = useState(false);
  const [isAddingRecommended, setIsAddingRecommended] = useState(null);

  // Fetch active cart, cart items, and saved items in parallel
  const fetchCartDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let activeCartId = cartId;

      // 1. If we don't have cartId in context, find it from the server
      if (!activeCartId && isAuthenticated) {
        const carts = await getCarts();
        const cartsList = Array.isArray(carts) ? carts : carts?.carts ?? [];
        const active = cartsList.find((c) => c.status === 'active');
        if (active) {
          activeCartId = active.cart_id;
          setCartId(activeCartId);
        }
      }

      // 2. Fetch cart items, saved items, and products in parallel
      const cartPromise = activeCartId ? getCartItemsById(activeCartId) : Promise.resolve([]);
      const savedPromise = isAuthenticated ? getSavedItems() : Promise.resolve([]);
      const productsPromise = getProducts();

      const [cartItems, savedList, productsList] = await Promise.all([
        cartPromise,
        savedPromise,
        productsPromise
      ]);

      const rawItems = Array.isArray(cartItems) ? cartItems : [];
      const rawSaved = Array.isArray(savedList) ? savedList : [];
      const products = Array.isArray(productsList) ? productsList : (productsList?.items ?? productsList?.products ?? []);

      // 3. Merge cart item unit details with product catalog data
      const mergedItems = rawItems.map((item) => {
        const prod = products.find((p) => p.product_id === item.product_id);
        return {
          ...item,
          product_name: prod?.product_name || item.product_name,
          image_url: prod?.image_url || item.image_url,
          brand: prod?.brand || item.brand,
          category_id: prod?.category_id || item.category_id,
          average_rating: prod?.average_rating,
          reviews_count: prod?.reviews_count,
        };
      });

      // 4. Merge saved item details with product catalog data
      const mergedSaved = rawSaved.map((item) => {
        const prod = products.find((p) => p.product_id === item.product_id);
        return {
          ...item,
          product_name: prod?.product_name || item.product_name,
          image_url: prod?.image_url || item.image_url,
          brand: prod?.brand || item.brand,
          category_id: prod?.category_id || item.category_id,
          average_rating: prod?.average_rating,
          reviews_count: prod?.reviews_count,
        };
      });

      setItems(mergedItems);
      setSavedItems(mergedSaved);
      
      const totalCount = mergedItems.reduce((sum, item) => sum + item.quantity, 0);
      setItemCount(totalCount);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load cart items.'));
    } finally {
      setLoading(false);
    }
  }, [cartId, setCartId, setItemCount, isAuthenticated]);

  useEffect(() => {
    fetchCartDetails();
  }, [fetchCartDetails]);

  // Handle quantity update with optimistic state update
  const handleUpdateQuantity = useCallback(async (cartItemId, newQty) => {
    const previousItems = items;
    
    // Optimistic update of local items state
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.cart_item_id === cartItemId ? { ...item, quantity: newQty } : item
      )
    );

    // Optimistically update quantity in Cart Context
    const updatedItems = items.map((item) =>
      item.cart_item_id === cartItemId ? { ...item, quantity: newQty } : item
    );
    const totalCount = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
    setItemCount(totalCount);

    try {
      await updateCartItem(cartItemId, newQty);
    } catch {
      showToast('error', 'Failed to update quantity.');
      // Revert to server state
      setItems(previousItems);
      const originalCount = previousItems.reduce((sum, item) => sum + item.quantity, 0);
      setItemCount(originalCount);
    }
  }, [items, setItemCount, showToast]);

  // Handle item removal with optimistic state update
  const handleRemoveItem = useCallback(async (cartItemId) => {
    const previousItems = items;
    
    // Optimistic removal of item from state
    setItems((prevItems) => prevItems.filter((item) => item.cart_item_id !== cartItemId));
    
    // Optimistically update count in Cart Context
    const updatedItems = items.filter((item) => item.cart_item_id !== cartItemId);
    const totalCount = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
    setItemCount(totalCount);

    try {
      await deleteCartItem(cartItemId);
      showToast('success', 'Item removed from cart.');
    } catch {
      showToast('error', 'Failed to remove item from cart.');
      // Revert to server state
      setItems(previousItems);
      const originalCount = previousItems.reduce((sum, item) => sum + item.quantity, 0);
      setItemCount(originalCount);
    }
  }, [items, setItemCount, showToast]);

  // Move cart item to Save For Later
  const handleSaveForLater = useCallback(async (item) => {
    if (!isAuthenticated) {
      showToast('info', 'Please log in to save items for later.');
      return;
    }
    setIsSaving(true);
    try {
      await saveItem({
        product_id: item.product_id,
        variant_id: item.variant_id,
        cart_item_id: item.cart_item_id
      });
      showToast('success', `${item.product_name} saved for later.`);
      await fetchCartDetails();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to save item for later.'));
    } finally {
      setIsSaving(false);
    }
  }, [isAuthenticated, fetchCartDetails, showToast]);

  // Remove saved item
  const handleRemoveSavedItem = useCallback(async (id) => {
    setIsDeletingSaved(true);
    try {
      await deleteSavedItem(id);
      showToast('success', 'Item removed from saved list.');
      await fetchCartDetails();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to remove saved item.'));
    } finally {
      setIsDeletingSaved(false);
    }
  }, [fetchCartDetails, showToast]);

  // Move saved item back to Cart
  const handleMoveToCart = useCallback(async (id) => {
    setIsMoving(true);
    try {
      await moveSavedItemToCart(id);
      showToast('success', 'Item moved back to cart.');
      await fetchCartDetails();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to move item to cart.'));
    } finally {
      setIsMoving(false);
    }
  }, [fetchCartDetails, showToast]);

  // Add recommended product to cart (Home-style handler)
  const handleRecommendAddToCart = useCallback(async (product) => {
    if (!isAuthenticated) {
      showToast('info', 'Please log in to add items to your cart.');
      return;
    }
    setIsAddingRecommended(product.product_id);
    try {
      let activeCartId = cartId;
      if (!activeCartId) {
        const newCart = await createCart();
        activeCartId = newCart.cart_id ?? newCart.id;
        setCartId(activeCartId);
      }
      await addCartItem({ cart_id: activeCartId, product_id: product.product_id, quantity: 1 });
      showToast('success', `${product.product_name} added to cart!`);
      await fetchCartDetails();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to add item to cart.'));
    } finally {
      setIsAddingRecommended(null);
    }
  }, [isAuthenticated, cartId, setCartId, fetchCartDetails, showToast]);

  // Compute total item count from cart items
  const totalCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  if (loading) {
    return (
      <PageLayout>
        <div className="cart-page__loading">
          <Spinner size="lg" />
          <p className="cart-page__loading-text">Loading your cart...</p>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="cart-page__error">
          <ErrorState message={error} onRetry={fetchCartDetails} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="lovable-cart-page">
        <div className="cart-page container">
          {/* Breadcrumb Navigation */}
          <nav className="cart-breadcrumbs" aria-label="Breadcrumb">
            <Link to={ROUTES.HOME} className="cart-breadcrumbs__link">Home</Link>
            <span className="cart-breadcrumbs__separator">&gt;</span>
            <Link to={ROUTES.HOME} className="cart-breadcrumbs__link">Shop</Link>
            <span className="cart-breadcrumbs__separator">&gt;</span>
            <span className="cart-breadcrumbs__current" aria-current="page">Cart</span>
          </nav>

          {/* Restructured Header area */}
          <div className="cart-page__header">
            <div className="cart-page__header-left">
              <h1 className="cart-page__title">Your cart</h1>
              {items.length > 0 && (
                <p className="cart-page__subtitle">
                  {totalCount} {totalCount === 1 ? 'item' : 'items'} ready for checkout
                </p>
              )}
            </div>
            <div className="cart-page__header-right">
              <Link to={ROUTES.HOME} className="cart-page__continue-link">
                Continue shopping &rarr;
              </Link>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="cart-page__empty-wrap">
              <EmptyCart />
              
              <SaveForLater
                savedItems={savedItems}
                onMoveToCart={handleMoveToCart}
                onRemoveSavedItem={handleRemoveSavedItem}
                isMoving={isMoving}
                isDeleting={isDeletingSaved}
              />

              <CartRecommendations
                cartItems={items}
                onAddToCart={handleRecommendAddToCart}
                isAddingProductId={isAddingRecommended}
              />
            </div>
          ) : (
            <>
              <div className="cart-page__content">
                {/* Left Area (70%): Cart items, Delivery, Saved for Later */}
                <div className="cart-page__list-wrap">
                  <CartItemList
                    items={items}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemoveItem={handleRemoveItem}
                    onSaveForLater={handleSaveForLater}
                    isSaving={isSaving}
                  />

                  {/* Delivery options section */}
                  <DeliveryOptions />

                  {/* Save For Later Section */}
                  <SaveForLater
                    savedItems={savedItems}
                    onMoveToCart={handleMoveToCart}
                    onRemoveSavedItem={handleRemoveSavedItem}
                    isMoving={isMoving}
                    isDeleting={isDeletingSaved}
                  />
                </div>

                {/* Right Area (30%): Sticky Order Summary panel */}
                <div className="cart-page__summary-wrap">
                  <CartSummary items={items} />
                </div>
              </div>

              {/* Recommendations below items on desktop/mobile */}
              <CartRecommendations
                cartItems={items}
                onAddToCart={handleRecommendAddToCart}
                isAddingProductId={isAddingRecommended}
              />

              {/* Mobile Sticky Bottom checkout bar */}
              <StickyCheckoutBar items={items} />
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
