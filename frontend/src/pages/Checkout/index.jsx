import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { CheckoutCustomerForm } from './components/CheckoutCustomerForm.jsx';
import { CheckoutDeliveryCard } from './components/CheckoutDeliveryCard.jsx';
import { CheckoutPaymentSelector } from './components/CheckoutPaymentSelector.jsx';
import { OrderSummary } from './components/OrderSummary/index.jsx';
import { Spinner } from '../../components/ui/Spinner/index.jsx';
import { ErrorState } from '../../components/ui/ErrorState/index.jsx';
import { useCart } from '../../hooks/useCart.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { getCarts, getCartItemsById } from '../../services/cartService.js';
import { getProducts } from '../../services/productService.js';
import { placeOrder } from '../../services/orderService.js';
import { calculateShipping, calculateTotal } from '../../utils/pricing.js';
import { formatCurrency } from '../../utils/formatters.js';
import { extractErrorMessage } from '../../utils/extractErrorMessage.js';
import { ROUTES } from '../../constants/routes.js';
import './index.css';

/**
 * Checkout Page — collects shipping & payment info, displays order summary,
 * pre-fills user details, validates inputs, and handles order submission.
 */
export default function Checkout() {
  useDocumentTitle('Checkout');

  const navigate = useNavigate();
  const { cartId, setCartId, resetCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Data states
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state fields
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    notes: '',
    paymentMethod: 'COD',
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [backendError, setBackendError] = useState(null);

  // Prefill customer profile & last used address from localStorage on mount
  useEffect(() => {
    const cachedName = localStorage.getItem('checkout_name') || user?.username || '';
    const cachedPhone = localStorage.getItem('checkout_phone') || '';
    const cachedEmail = localStorage.getItem('checkout_email') || '';
    const cachedAddr1 = localStorage.getItem('checkout_address_line1') || '';
    const cachedAddr2 = localStorage.getItem('checkout_address_line2') || '';
    const cachedCity = localStorage.getItem('checkout_city') || '';
    const cachedState = localStorage.getItem('checkout_state') || '';
    const cachedPin = localStorage.getItem('checkout_pincode') || '';

    setFormData((prev) => ({
      ...prev,
      name: cachedName,
      phone: cachedPhone,
      email: cachedEmail,
      addressLine1: cachedAddr1,
      addressLine2: cachedAddr2,
      city: cachedCity,
      state: cachedState,
      pincode: cachedPin,
    }));
  }, [user]);

  const fetchCheckoutData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let activeCartId = cartId;

      if (!activeCartId) {
        const carts = await getCarts();
        const cartsList = Array.isArray(carts) ? carts : carts?.carts ?? [];
        const active = cartsList.find((c) => c.status === 'active');
        if (active) {
          activeCartId = active.cart_id;
          setCartId(activeCartId);
        }
      }

      if (!activeCartId) {
        setItems([]);
        setLoading(false);
        return;
      }

      const [cartItems, productsList] = await Promise.all([
        getCartItemsById(activeCartId),
        getProducts(),
      ]);

      const rawItems = Array.isArray(cartItems) ? cartItems : [];
      const products = Array.isArray(productsList) ? productsList : productsList?.products ?? [];

      const merged = rawItems.map((item) => {
        const prod = products.find((p) => p.product_id === item.product_id);
        return {
          ...item,
          product_name: prod?.product_name || `Product #${item.product_id}`,
        };
      });

      setItems(merged);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load checkout details.'));
    } finally {
      setLoading(false);
    }
  }, [cartId, setCartId]);

  useEffect(() => {
    fetchCheckoutData();
  }, [fetchCheckoutData]);

  // Derive pricing values
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [items]);

  const shipping = useMemo(() => {
    return calculateShipping(subtotal, items);
  }, [subtotal, items]);

  const grandTotal = useMemo(() => {
    return calculateTotal(subtotal, shipping, 0);
  }, [subtotal, shipping]);

  // Field validation rules
  const validateField = useCallback((id, value) => {
    switch (id) {
      case 'name':
        if (!value || !value.trim()) return 'Full Name is required.';
        if (value.trim().length < 3) return 'Full Name must be at least 3 characters.';
        return null;
      case 'phone':
        if (!value) return 'Mobile Number is required.';
        if (!/^\d{10}$/.test(value)) return 'Mobile Number must be exactly 10 digits.';
        return null;
      case 'email':
        if (!value || !value.trim()) return 'Email Address is required.';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) return 'Please enter a valid email address.';
        return null;
      case 'addressLine1':
        if (!value || !value.trim()) return 'Address Line 1 is required.';
        return null;
      case 'city':
        if (!value || !value.trim()) return 'City is required.';
        return null;
      case 'state':
        if (!value || !value.trim()) return 'State is required.';
        return null;
      case 'pincode':
        if (!value) return 'Pincode is required.';
        if (!/^\d{6}$/.test(value)) return 'Pincode must be exactly 6 digits.';
        return null;
      default:
        return null;
    }
  }, []);

  // Form-wide validity checks (determines Place Order button state)
  const isValid = useMemo(() => {
    const requiredFields = ['name', 'phone', 'email', 'addressLine1', 'city', 'state', 'pincode'];
    for (const field of requiredFields) {
      const val = formData[field];
      if (!val || validateField(field, val) !== null) {
        return false;
      }
    }
    return true;
  }, [formData, validateField]);

  // Input change handler
  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    
    // Clear errors dynamically
    const errorMsg = validateField(id, value);
    setErrors((prev) => ({ ...prev, [id]: errorMsg }));
  };

  // Payment method selection change
  const handlePaymentChange = (methodId) => {
    setFormData((prev) => ({ ...prev, paymentMethod: methodId }));
  };

  // Submit order action
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // Final validation block
    const formErrors = {};
    const requiredFields = ['name', 'phone', 'email', 'addressLine1', 'city', 'state', 'pincode'];
    
    requiredFields.forEach((field) => {
      const err = validateField(field, formData[field]);
      if (err) formErrors[field] = err;
    });

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      showToast('error', 'Please correct the validation errors before placing your order.');
      return;
    }

    setSubmitting(true);
    setBackendError(null);

    const startTime = Date.now();

    // Build the shipping address string
    const combinedAddress = [
      formData.addressLine1.trim(),
      formData.addressLine2?.trim(),
      formData.city.trim(),
      formData.state.trim()
    ].filter(Boolean).join(', ') + ` - ${formData.pincode.trim()}`;

    try {
      const response = await placeOrder({
        cart_id: cartId,
        name: formData.name.trim(),
        email: formData.email.trim(),
        address: combinedAddress,
        phone: formData.phone.trim(),
        paymentMethod: formData.paymentMethod,
        notes: formData.notes?.trim() || ''
      });

      // Persist delivery address in localStorage
      localStorage.setItem('checkout_name', formData.name.trim());
      localStorage.setItem('checkout_phone', formData.phone.trim());
      localStorage.setItem('checkout_email', formData.email.trim());
      localStorage.setItem('checkout_address_line1', formData.addressLine1.trim());
      localStorage.setItem('checkout_address_line2', formData.addressLine2?.trim() || '');
      localStorage.setItem('checkout_city', formData.city.trim());
      localStorage.setItem('checkout_state', formData.state.trim());
      localStorage.setItem('checkout_pincode', formData.pincode.trim());

      // Ensure the processing loader is visible for at least 900ms
      const duration = Date.now() - startTime;
      const remainingDelay = Math.max(0, 900 - duration);
      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }

      resetCart();
      showToast('success', 'Order placed successfully!');
      
      const orderId = response.order_id;
      navigate(`/order-success/${orderId}`, { replace: true });
    } catch (err) {
      setBackendError(extractErrorMessage(err, 'Failed to place order. Please try again.'));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="checkout-page__loading">
          <Spinner size="lg" />
          <p className="checkout-page__loading-text">Preparing checkout...</p>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="checkout-page__error">
          <ErrorState message={error} onRetry={fetchCheckoutData} />
        </div>
      </PageLayout>
    );
  }

  // Guard: if empty cart, redirect to cart page
  if (items.length === 0) {
    return <Navigate to={ROUTES.CART} replace />;
  }

  return (
    <PageLayout>
      <div className="checkout-page container">
        {/* Visual progress stepper */}
        <div className="checkout-stepper">
          <div className="checkout-stepper__step checkout-stepper__step--completed">
            <span className="checkout-stepper__icon">✓</span>
            <Link to={ROUTES.CART} className="checkout-stepper__label">Cart</Link>
          </div>
          <div className="checkout-stepper__line checkout-stepper__line--completed"></div>
          <div className="checkout-stepper__step checkout-stepper__step--active">
            <span className="checkout-stepper__icon">●</span>
            <span className="checkout-stepper__label">Checkout</span>
          </div>
          <div className="checkout-stepper__line"></div>
          <div className="checkout-stepper__step checkout-stepper__step--upcoming">
            <span className="checkout-stepper__icon">○</span>
            <span className="checkout-stepper__label">Order Placed</span>
          </div>
        </div>

        <h1 className="checkout-page__title">Secure Checkout</h1>

        {/* Backend Error Banner */}
        {backendError && (
          <div className="checkout-page__error-banner" role="alert">
            <p className="checkout-page__error-message">{backendError}</p>
          </div>
        )}

        <div className="checkout-page__content">
          {/* Left Column: Form Sections */}
          <div className="checkout-page__form-wrap">
            <form id="checkout-form" onSubmit={handleSubmit} noValidate>
              <CheckoutCustomerForm
                formData={formData}
                errors={errors}
                onChange={handleInputChange}
                submitting={submitting}
              />
            </form>

            <CheckoutDeliveryCard shipping={shipping} items={items} subtotal={subtotal} />

            <CheckoutPaymentSelector
              selectedMethod={formData.paymentMethod}
              onChange={handlePaymentChange}
            />
          </div>

          {/* Right Column: Order Summary */}
          <div className="checkout-page__summary-wrap">
            <OrderSummary
              items={items}
              subtotal={subtotal}
              submitting={submitting}
              isValid={isValid}
            />
          </div>
        </div>
      </div>

      {/* Mobile Sticky Checkout Action Bar */}
      <div className="checkout-page__mobile-sticky">
        <div className="checkout-page__mobile-sticky-content container">
          <div className="checkout-page__mobile-sticky-info">
            <span className="checkout-page__mobile-sticky-label">Grand Total</span>
            <span className="checkout-page__mobile-sticky-val">{formatCurrency(grandTotal)}</span>
          </div>
          <button
            type="submit"
            form="checkout-form"
            className="btn btn--primary checkout-page__mobile-sticky-btn"
            disabled={!isValid || submitting}
          >
            {submitting ? 'Processing...' : 'Place Order'}
          </button>
        </div>
      </div>
    </PageLayout>
  );
}

