import { useState } from 'react';
import { InputField } from '../../../../components/ui/InputField/index.jsx';
import { PAYMENT_METHODS } from '../../../../constants/payment.js';
import { validateEmail, validateRequired } from '../../../../utils/validators.js';
import './index.css';

/**
 * CheckoutForm — controlled inputs for delivery details and payment method selection.
 * Validates inputs locally before calling onSubmit.
 *
 * @param {Function} onSubmit      Callback with form data: { name, email, address, phone, paymentMethod }
 * @param {boolean}  submitting    Whether the place order request is in-flight
 * @param {string}   backendError  Error message returned by backend
 */
export function CheckoutForm({ onSubmit, submitting, backendError }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    streetAddress: '',
    city: '',
    pincode: '',
    phone: '',
    paymentMethod: PAYMENT_METHODS[0]?.value || 'Cash',
  });

  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: null }));
  };

  const handleSelectChange = (e) => {
    setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }));
    setErrors((prev) => ({ ...prev, paymentMethod: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});

    // Validate fields
    const formErrors = {};
    
    const nameErr = validateRequired(formData.name, 'Full Name');
    if (nameErr) formErrors.name = nameErr;

    const emailErr = validateEmail(formData.email);
    if (emailErr) formErrors.email = emailErr;

    const streetErr = validateRequired(formData.streetAddress, 'Street Address');
    if (streetErr) formErrors.streetAddress = streetErr;

    const cityErr = validateRequired(formData.city, 'City');
    if (cityErr) formErrors.city = cityErr;

    const pinErr = validateRequired(formData.pincode, 'Pincode');
    if (pinErr) formErrors.pincode = pinErr;

    const phoneErr = validateRequired(formData.phone, 'Phone Number');
    if (phoneErr) formErrors.phone = phoneErr;

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    // Combine Address components
    const combinedAddress = `${formData.streetAddress.trim()}, ${formData.city.trim()} - ${formData.pincode.trim()}`;

    onSubmit({
      name: formData.name.trim(),
      email: formData.email.trim(),
      address: combinedAddress,
      phone: formData.phone.trim(),
      paymentMethod: formData.paymentMethod,
    });
  };

  return (
    <form id="checkout-form" className="checkout-form" onSubmit={handleSubmit} noValidate>
      <h2 className="checkout-form__title">Shipping & Payment</h2>

      {/* Backend Error Banner */}
      {backendError && (
        <div className="checkout-form__error-banner" role="alert">
          <p className="checkout-form__error-message">{backendError}</p>
        </div>
      )}

      <div className="checkout-form__sections">
        {/* SECTION 1: Contact Details */}
        <fieldset className="checkout-form__section" disabled={submitting}>
          <legend className="checkout-form__section-title">Contact Details</legend>
          <div className="checkout-form__row">
            <InputField
              id="name"
              label="Full Name *"
              autoComplete="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleInputChange}
              error={errors.name}
              required
            />
            <InputField
              id="phone"
              label="Phone Number *"
              type="tel"
              autoComplete="tel"
              placeholder="9876543210"
              value={formData.phone}
              onChange={handleInputChange}
              error={errors.phone}
              required
            />
          </div>
          <InputField
            id="email"
            label="Email Address *"
            type="email"
            autoComplete="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={handleInputChange}
            error={errors.email}
            required
            className="checkout-form__field-full"
          />
        </fieldset>

        {/* SECTION 2: Shipping Address & Location */}
        <fieldset className="checkout-form__section" disabled={submitting}>
          <legend className="checkout-form__section-title">Shipping Address</legend>
          <InputField
            id="streetAddress"
            label="Delivery Address *"
            as="textarea"
            rows="2"
            autoComplete="street-address"
            placeholder="123 Main St, Apartment 4B"
            value={formData.streetAddress}
            onChange={handleInputChange}
            error={errors.streetAddress}
            required
            className="checkout-form__field-full"
          />
          <div className="checkout-form__row">
            <InputField
              id="city"
              label="City *"
              placeholder="New York"
              value={formData.city}
              onChange={handleInputChange}
              error={errors.city}
              required
            />
            <InputField
              id="pincode"
              label="Pincode *"
              placeholder="10001"
              value={formData.pincode}
              onChange={handleInputChange}
              error={errors.pincode}
              required
            />
          </div>
        </fieldset>

        {/* SECTION 3: Payment Method */}
        <fieldset className="checkout-form__section" disabled={submitting}>
          <legend className="checkout-form__section-title">Payment Method</legend>
          <div className="checkout-form__select-wrap">
            <label className="checkout-form__select-label" htmlFor="payment-select">
              Payment Method *
            </label>
            <select
              id="payment-select"
              className="checkout-form__select"
              value={formData.paymentMethod}
              onChange={handleSelectChange}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      </div>
    </form>
  );
}
