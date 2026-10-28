import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { CheckoutCustomerForm } from './components/CheckoutCustomerForm.jsx';
import { CheckoutDeliveryCard } from './components/CheckoutDeliveryCard.jsx';
import { CheckoutPaymentSelector } from './components/CheckoutPaymentSelector.jsx';
import { OrderSummary } from './components/OrderSummary/index.jsx';
import { CouponInput } from './components/CouponInput/index.jsx';
import { Spinner } from '../../components/ui/Spinner/index.jsx';
import { ErrorState } from '../../components/ui/ErrorState/index.jsx';
import { useCart } from '../../hooks/useCart.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { getCarts, getCartItemsById, getCartSummary } from '../../services/cartService.js';
import { getProducts } from '../../services/productService.js';
import { placeOrder } from '../../services/orderService.js';
import { initiatePayment } from '../../services/paymentService.js';
import { formatCurrency } from '../../utils/formatters.js';
import { extractErrorMessage } from '../../utils/extractErrorMessage.js';
import { useTelemetry } from '../../hooks/useTelemetry.js';
import { ROUTES } from '../../constants/routes.js';
import { AlertCircle } from 'lucide-react';
import './index.css';

const CHECKOUT_STORAGE_KEYS = {
  name: 'checkout_name',
  phone: 'checkout_phone',
  email: 'checkout_email',
  addressLine1: 'checkout_address_line1',
  addressLine2: 'checkout_address_line2',
  city: 'checkout_city',
  state: 'checkout_state',
  pincode: 'checkout_pincode'
};

const readCheckoutDraft = (key) => {
  try {
    return sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

const writeCheckoutDraft = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Checkout must keep working even when browser storage is unavailable.
  }
};

const clearCheckoutDraft = () => {
  try {
    Object.values(CHECKOUT_STORAGE_KEYS).forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Non-critical cleanup.
  }
};

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
  const { trackEvent } = useTelemetry();

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

  // Coupon state — the applied coupon result from the backend, or null
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Pricing summary state (Phase 5F)
  const [summary, setSummary] = useState({
    original_price: 0,
    subtotal: 0,
    discount_amount: 0,
    coupon_savings: 0,
    shipping_fee: 0,
    tax_amount: 0,
    final_total: 0
  });

  // Prefill only from the active checkout tab, not persistent browser storage.
  useEffect(() => {
    const cachedName = readCheckoutDraft(CHECKOUT_STORAGE_KEYS.name) || user?.username || '';
    const cachedPhone = readCheckoutDraft(CHECKOUT_STORAGE_KEYS.phone);
    const cachedEmail = readCheckoutDraft(CHECKOUT_STORAGE_KEYS.email);
    const cachedAddr1 = readCheckoutDraft(CHECKOUT_STORAGE_KEYS.addressLine1);
    const cachedAddr2 = readCheckoutDraft(CHECKOUT_STORAGE_KEYS.addressLine2);
    const cachedCity = readCheckoutDraft(CHECKOUT_STORAGE_KEYS.city);
    const cachedState = readCheckoutDraft(CHECKOUT_STORAGE_KEYS.state);
    const cachedPin = readCheckoutDraft(CHECKOUT_STORAGE_KEYS.pincode);

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

      const [cartItems, productsList, summaryData] = await Promise.all([
        getCartItemsById(activeCartId),
        getProducts(),
        getCartSummary()
      ]);

      const rawItems = Array.isArray(cartItems) ? cartItems : [];
      const products = Array.isArray(productsList) ? productsList : (productsList?.items ?? productsList?.products ?? []);

      const merged = rawItems.map((item) => {
        const prod = products.find((p) => p.product_id === item.product_id);
        return {
          ...item,
          product_name: prod?.product_name || `Product #${item.product_id}`,
        };
      });

      setItems(merged);
      setSummary(summaryData);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load checkout details.'));
    } finally {
      setLoading(false);
    }
  }, [cartId, setCartId]);

  useEffect(() => {
    fetchCheckoutData();
  }, [fetchCheckoutData]);

  // ─── Coupon handlers ──────────────────────────────────────────────────
  const handleApplyCoupon = useCallback(async (couponCode) => {
    try {
      const result = await getCartSummary(couponCode);
      if (!result.coupon_valid) {
        throw new Error(result.coupon_message || 'Coupon code is invalid.');
      }
      setSummary(result);
      setAppliedCoupon({
        coupon_code: couponCode,
        discount_amount: result.coupon_savings
      });
      showToast('success', result.coupon_message || 'Coupon applied successfully!');
    } catch (err) {
      showToast('error', err.message || 'Failed to apply coupon.');
      throw err;
    }
  }, [showToast]);

  const handleRemoveCoupon = useCallback(async () => {
    setAppliedCoupon(null);
    try {
      const summaryData = await getCartSummary();
      setSummary(summaryData);
      showToast('info', 'Coupon removed');
    } catch (err) {
      console.error('Failed to reset cart summary after coupon removal:', err.message);
    }
  }, [showToast]);

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

    if (CHECKOUT_STORAGE_KEYS[id]) {
      writeCheckoutDraft(CHECKOUT_STORAGE_KEYS[id], value);
    }
    
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
    if (submitting) return;

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
        notes: formData.notes?.trim() || '',
        ...(appliedCoupon ? { coupon_code: appliedCoupon.coupon_code } : {})
      });

      // Ensure the processing loader is visible for at least 900ms
      const duration = Date.now() - startTime;
      const remainingDelay = Math.max(0, 900 - duration);
      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }

      resetCart();
      clearCheckoutDraft();
      const orderId = response.order_id;
      trackEvent('purchase_complete', {
        metadata: {
          order_id: orderId,
          total_amount: summary.final_total
        }
      });

      if (formData.paymentMethod === 'COD') {
        showToast('success', 'Order placed successfully!');
        navigate(`/order-success/${orderId}`, { replace: true });
      } else {
        showToast('info', 'Redirecting to payment gateway...');
        try {
          await initiatePayment(orderId, formData.paymentMethod, `initiate-${orderId}`);
        } catch (initErr) {
          console.warn('Failed to initiate payment on first attempt, will try again on payment page:', initErr.message);
        }
        navigate(`/payment/${orderId}`, { replace: true });
      }
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
      <div className="lovable-checkout-page">
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

          {/* Restructured Header area */}
          <div className="checkout-page__header">
            <div className="checkout-page__header-left">
              <h1 className="checkout-page__title">Secure Checkout</h1>
              <p className="checkout-page__subtitle">
                Please review and complete your shipping and payment information.
              </p>
            </div>
            <div className="checkout-page__header-right">
              <Link to={ROUTES.CART} className="checkout-page__back-link">
                &larr; Return to Cart
              </Link>
            </div>
          </div>

          {/* Backend Error Banner */}
          {backendError && (
            <div className="checkout-page__error-banner" role="alert">
              <AlertCircle size={16} className="checkout-page__error-icon" style={{ marginRight: '8px', flexShrink: 0 }} />
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

              <CheckoutDeliveryCard shipping={summary.shipping_fee} items={items} subtotal={summary.subtotal} />

              <CheckoutPaymentSelector
                selectedMethod={formData.paymentMethod}
                onChange={handlePaymentChange}
              />
            </div>

            {/* Right Column: Order Summary */}
            <div className="checkout-page__summary-wrap">
              <CouponInput
                onApply={handleApplyCoupon}
                onRemove={handleRemoveCoupon}
                appliedCoupon={appliedCoupon}
                disabled={submitting}
              />
              <OrderSummary
                items={items}
                summary={summary}
                submitting={submitting}
                isValid={isValid}
                appliedCoupon={appliedCoupon}
              />
            </div>
          </div>
        </div>

        {/* Mobile Sticky Checkout Action Bar */}
        <div className="checkout-page__mobile-sticky">
          <div className="checkout-page__mobile-sticky-content container">
            <div className="checkout-page__mobile-sticky-info">
              <span className="checkout-page__mobile-sticky-label">Grand Total</span>
              <span className="checkout-page__mobile-sticky-val">{formatCurrency(summary.final_total)}</span>
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
      </div>
    </PageLayout>
  );
}
