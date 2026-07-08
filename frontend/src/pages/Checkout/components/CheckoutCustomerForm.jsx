import React from 'react';
import { User, MapPin, NotebookPen } from 'lucide-react';
import { InputField } from '../../../components/ui/InputField/index.jsx';
import './CheckoutCustomerForm.css';

export function CheckoutCustomerForm({ formData, errors, onChange, submitting }) {
  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange({ target: { id: 'phone', value: val } });
  };

  const handlePincodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange({ target: { id: 'pincode', value: val } });
  };

  return (
    <div className="checkout-customer-form">
      {/* SECTION 1: Contact Details */}
      <fieldset className="checkout-customer-form__section" disabled={submitting}>
        <div className="checkout-customer-form__section-header">
          <User className="checkout-customer-form__section-icon" size={18} />
          <legend className="checkout-customer-form__section-title">Customer Information</legend>
        </div>
        
        <div className="checkout-customer-form__row">
          <InputField
            id="name"
            label="Full Name *"
            autoComplete="name"
            placeholder="John Doe"
            value={formData.name}
            onChange={(e) => onChange(e)}
            error={errors.name}
            required
          />
          <InputField
            id="phone"
            label="Mobile Number *"
            type="tel"
            autoComplete="tel"
            placeholder="9876543210"
            value={formData.phone}
            onChange={handlePhoneChange}
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
          onChange={(e) => onChange(e)}
          error={errors.email}
          required
          className="checkout-customer-form__field-full"
        />
      </fieldset>

      {/* SECTION 2: Shipping Address */}
      <fieldset className="checkout-customer-form__section" disabled={submitting}>
        <div className="checkout-customer-form__section-header">
          <MapPin className="checkout-customer-form__section-icon" size={18} />
          <legend className="checkout-customer-form__section-title">Delivery Address</legend>
        </div>

        <div className="checkout-customer-form__row">
          <InputField
            id="addressLine1"
            label="Address Line 1 *"
            autoComplete="shipping address-line1"
            placeholder="Flat, House no., Building, Company, Apartment"
            value={formData.addressLine1}
            onChange={(e) => onChange(e)}
            error={errors.addressLine1}
            required
          />
          <InputField
            id="addressLine2"
            label="Address Line 2 (Optional)"
            autoComplete="shipping address-line2"
            placeholder="Area, Street, Sector, Village"
            value={formData.addressLine2}
            onChange={(e) => onChange(e)}
            error={errors.addressLine2}
          />
        </div>

        <div className="checkout-customer-form__row-triple">
          <InputField
            id="city"
            label="City *"
            autoComplete="shipping address-level2"
            placeholder="Mumbai"
            value={formData.city}
            onChange={(e) => onChange(e)}
            error={errors.city}
            required
          />
          <InputField
            id="state"
            label="State *"
            autoComplete="shipping address-level1"
            placeholder="Maharashtra"
            value={formData.state}
            onChange={(e) => onChange(e)}
            error={errors.state}
            required
          />
          <InputField
            id="pincode"
            label="Pincode *"
            autoComplete="postal-code"
            placeholder="400001"
            value={formData.pincode}
            onChange={handlePincodeChange}
            error={errors.pincode}
            required
          />
        </div>
      </fieldset>

      {/* SECTION 3: Order Notes */}
      <fieldset className="checkout-customer-form__section" disabled={submitting}>
        <div className="checkout-customer-form__section-header">
          <NotebookPen className="checkout-customer-form__section-icon" size={18} />
          <legend className="checkout-customer-form__section-title">Order Notes (optional)</legend>
        </div>
        <InputField
          id="notes"
          label="Additional Delivery Instructions"
          as="textarea"
          rows="3"
          placeholder="e.g., 'Call before delivery.', 'Deliver after 5 PM.'"
          value={formData.notes}
          onChange={(e) => onChange(e)}
          error={errors.notes}
          className="checkout-customer-form__field-full"
        />
      </fieldset>
    </div>
  );
}
export default CheckoutCustomerForm;
