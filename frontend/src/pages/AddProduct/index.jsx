import { useState } from 'react';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { InputField } from '../../components/ui/InputField/index.jsx';
import { Button } from '../../components/ui/Button/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { addProduct } from '../../services/productService.js';
import { CATEGORIES } from '../../constants/categories.js';
import {
  validateRequired,
  validatePositiveNumber,
  validateSellingVsCost,
} from '../../utils/validators.js';
import { extractErrorMessage } from '../../utils/extractErrorMessage.js';
import './index.css';

/**
 * AddProduct Page — form for suppliers and admins to add new products to the shop catalog.
 */
export default function AddProduct() {
  useDocumentTitle('Add Product');

  const { user } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    product_name: '',
    category: CATEGORIES[0]?.name || 'Others',
    description: '',
    date_of_manufacture: '',
    selling_price: '',
    cost_price: '',
    image_url: '',
    size_or_quantity: '',
    supplier_id: '',
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: null }));
  };

  const handleSelectChange = (e) => {
    setFormData((prev) => ({ ...prev, category: e.target.value }));
    setErrors((prev) => ({ ...prev, category: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const formErrors = {};
    const nameErr = validateRequired(formData.product_name, 'Product Name');
    if (nameErr) formErrors.product_name = nameErr;

    const dateErr = validateRequired(formData.date_of_manufacture, 'Date of Manufacture');
    if (dateErr) formErrors.date_of_manufacture = dateErr;

    const sellPriceErr = validatePositiveNumber(formData.selling_price, 'Selling Price');
    if (sellPriceErr) formErrors.selling_price = sellPriceErr;

    const costPriceErr = validatePositiveNumber(formData.cost_price, 'Cost Price');
    if (costPriceErr) formErrors.cost_price = costPriceErr;

    // Validate selling vs cost
    if (!sellPriceErr && !costPriceErr) {
      const vsErr = validateSellingVsCost(formData.selling_price, formData.cost_price);
      if (vsErr) formErrors.selling_price = vsErr;
    }

    if (user?.role === 'admin') {
      const supplierErr = validateRequired(formData.supplier_id, 'Supplier ID');
      if (supplierErr) formErrors.supplier_id = supplierErr;
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        product_name: formData.product_name.trim(),
        category: formData.category,
        description: formData.description.trim(),
        date_of_manufacture: formData.date_of_manufacture,
        selling_price: parseFloat(formData.selling_price),
        cost_price: parseFloat(formData.cost_price),
        image_url: formData.image_url.trim(),
        size_or_quantity: formData.size_or_quantity.trim(),
      };

      if (user?.role === 'admin') {
        payload.supplier_id = parseInt(formData.supplier_id, 10);
      }

      await addProduct(payload);
      showToast('success', 'Product added successfully!');
      
      // Reset form
      setFormData({
        product_name: '',
        category: CATEGORIES[0]?.name || 'Others',
        description: '',
        date_of_manufacture: '',
        selling_price: '',
        cost_price: '',
        image_url: '',
        size_or_quantity: '',
        supplier_id: '',
      });
    } catch (err) {
      const errorMsg = extractErrorMessage(err, 'Failed to add product.');
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <div className="add-product-page container">
        <div className="add-product-page__card">
          <header className="add-product-page__header">
            <h1 className="add-product-page__title">Add New Product</h1>
            <p className="add-product-page__subtitle">List a new product in the shop catalog</p>
          </header>

          <form className="add-product-page__form" onSubmit={handleSubmit} noValidate>
            {/* Name */}
            <InputField
              id="product_name"
              label="Product Name *"
              placeholder="E.g., Wireless Headphones"
              value={formData.product_name}
              onChange={handleInputChange}
              error={errors.product_name}
              required
              disabled={submitting}
            />

            {/* Category Select */}
            <div className="add-product-page__select-wrap">
              <label className="add-product-page__select-label" htmlFor="category-select">
                Category *
              </label>
              <select
                id="category-select"
                className="add-product-page__select"
                value={formData.category}
                onChange={handleSelectChange}
                disabled={submitting}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <InputField
              id="description"
              label="Description"
              as="textarea"
              rows="3"
              placeholder="Provide a detailed description of the product..."
              value={formData.description}
              onChange={handleInputChange}
              error={errors.description}
              disabled={submitting}
            />

            {/* Size or Quantity */}
            <InputField
              id="size_or_quantity"
              label="Size / Quantity / Spec"
              placeholder="E.g., 250ml, Pack of 4, Size L, 100g"
              value={formData.size_or_quantity}
              onChange={handleInputChange}
              error={errors.size_or_quantity}
              disabled={submitting}
            />

            {/* Image URL */}
            <InputField
              id="image_url"
              label="Image URL"
              placeholder="https://images.unsplash.com/..."
              value={formData.image_url}
              onChange={handleInputChange}
              error={errors.image_url}
              disabled={submitting}
            />

            {/* Date of Manufacture */}
            <InputField
              id="date_of_manufacture"
              label="Date of Manufacture *"
              type="date"
              value={formData.date_of_manufacture}
              onChange={handleInputChange}
              error={errors.date_of_manufacture}
              required
              disabled={submitting}
            />

            {/* Prices Row */}
            <div className="add-product-page__row">
              <InputField
                id="cost_price"
                label="Cost Price (INR) *"
                type="number"
                min="0"
                step="0.01"
                placeholder="100.00"
                value={formData.cost_price}
                onChange={handleInputChange}
                error={errors.cost_price}
                required
                disabled={submitting}
              />

              <InputField
                id="selling_price"
                label="Selling Price (INR) *"
                type="number"
                min="0"
                step="0.01"
                placeholder="149.00"
                value={formData.selling_price}
                onChange={handleInputChange}
                error={errors.selling_price}
                required
                disabled={submitting}
              />
            </div>

            {/* Supplier ID (Admin only) */}
            {user?.role === 'admin' && (
              <InputField
                id="supplier_id"
                label="Supplier ID (Admin Override) *"
                type="number"
                placeholder="E.g., 1"
                value={formData.supplier_id}
                onChange={handleInputChange}
                error={errors.supplier_id}
                required
                disabled={submitting}
              />
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="add-product-page__submit-btn"
              loading={submitting}
            >
              Add Product
            </Button>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
