import { useState, useEffect } from 'react';
import { Tag, Plus, Check, X, Calendar, User, Eye, Edit2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { createCoupon, getAllCoupons, updateCoupon } from '../../../services/couponService.js';
import { getProducts } from '../../../services/productService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { Button } from '../../../components/ui/Button/index.jsx';
import { formatCurrency } from '../../../utils/formatters.js';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

export default function Coupons() {
  useDocumentTitle('Coupons & Promotions — ShopCart Admin');
  const { showToast } = useToast();

  const [coupons, setCoupons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // New Coupon form
  const [formData, setFormData] = useState({
    coupon_code: '',
    coupon_type: 'fixed',
    discount_value: '',
    min_order_value: '0',
    max_discount_amount: '',
    usage_limit: '',
    per_user_limit: '1',
    expiration_date: '',
    status: 'active',
    category_ids: [],
    product_ids: []
  });

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [couponData, categoryData, productData] = await Promise.all([
        getAllCoupons(),
        adminService.getCategories(),
        getProducts({ limit: 1000 })
      ]);
      setCoupons(couponData);
      setCategories(categoryData || []);
      
      const prodsList = Array.isArray(productData) ? productData : productData?.products ?? [];
      setProducts(prodsList);
      setError(null);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to load initial data');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleOpenCreate = () => {
    setFormData({
      coupon_code: '',
      coupon_type: 'fixed',
      discount_value: '',
      min_order_value: '0',
      max_discount_amount: '',
      usage_limit: '',
      per_user_limit: '1',
      expiration_date: '',
      status: 'active',
      category_ids: [],
      product_ids: []
    });
    setEditingCoupon(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      coupon_code: coupon.coupon_code,
      coupon_type: coupon.coupon_type,
      discount_value: coupon.discount_value.toString(),
      min_order_value: coupon.min_order_value ? coupon.min_order_value.toString() : '0',
      max_discount_amount: coupon.max_discount_amount ? coupon.max_discount_amount.toString() : '',
      usage_limit: coupon.usage_limit ? coupon.usage_limit.toString() : '',
      per_user_limit: coupon.per_user_limit ? coupon.per_user_limit.toString() : '1',
      expiration_date: coupon.expiration_date || '',
      status: coupon.status,
      category_ids: coupon.categories?.map(c => c.category_id) || [],
      product_ids: coupon.products?.map(p => p.product_id) || []
    });
    setShowCreateModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const code = formData.coupon_code.trim().toUpperCase();
    if (!code) {
      showToast('error', 'Coupon code is required.');
      return;
    }

    const payload = {
      coupon_code: code,
      coupon_type: formData.coupon_type,
      discount_value: parseFloat(formData.discount_value),
      min_order_value: parseFloat(formData.min_order_value || '0'),
      max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
      usage_limit: formData.usage_limit ? parseInt(formData.usage_limit, 10) : null,
      per_user_limit: formData.per_user_limit ? parseInt(formData.per_user_limit, 10) : 1,
      expiration_date: formData.expiration_date || null,
      status: formData.status
    };

    if (isNaN(payload.discount_value)) {
      showToast('error', 'Valid discount value is required.');
      return;
    }

    setFormLoading(true);
    try {
      if (editingCoupon) {
        // Under Phase 5D rules, updates only touch: status, expiration_date, usage_limit, per_user_limit
        // Unless redemption_count === 0, then we can also update type/value (handled in backend).
        const updatePayload = {
          status: formData.status,
          expiration_date: formData.expiration_date || null,
          usage_limit: formData.usage_limit ? parseInt(formData.usage_limit, 10) : null,
          per_user_limit: formData.per_user_limit ? parseInt(formData.per_user_limit, 10) : 1
        };

        if (editingCoupon.redemption_count === 0) {
          updatePayload.coupon_type = formData.coupon_type;
          updatePayload.discount_value = parseFloat(formData.discount_value);
        }

        await updateCoupon(editingCoupon.coupon_id, updatePayload);
        showToast('success', 'Coupon updated successfully.');
      } else {
        // Create includes restrictions
        payload.category_ids = formData.category_ids;
        payload.product_ids = formData.product_ids;
        await createCoupon(payload);
        showToast('success', 'Coupon created successfully.');
      }
      setShowCreateModal(false);
      await fetchInitialData();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to save coupon'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (coupon) => {
    const nextStatus = coupon.status === 'active' ? 'inactive' : 'active';
    try {
      await updateCoupon(coupon.coupon_id, { status: nextStatus });
      showToast('success', `Coupon marked as ${nextStatus}.`);
      await fetchInitialData();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to toggle status'));
    }
  };

  const handleMultiSelectChange = (field, id) => {
    setFormData(prev => {
      const current = prev[field];
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      return { ...prev, [field]: next };
    });
  };

  if (loading) {
    return (
      <div className="admin-coupons-loading">
        <Spinner size="lg" />
        <p>Loading coupons directory...</p>
      </div>
    );
  }

  return (
    <div className="admin-coupons-page">
      <div className="admin-coupons-page__header">
        <div>
          <h1 className="admin-coupons-page__title">Coupons & Campaigns</h1>
          <p className="admin-coupons-page__subtitle">
            Configure, restrict, and monitor coupon discounts.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenCreate} className="admin-coupons-page__add-btn">
          <Plus size={16} />
          Create Coupon
        </Button>
      </div>

      {error ? (
        <div className="admin-coupons-page__error-state">
          <AlertTriangle size={32} />
          <p>{error}</p>
          <Button variant="secondary" onClick={fetchInitialData}>Try Again</Button>
        </div>
      ) : coupons.length === 0 ? (
        <div className="admin-coupons-page__empty-state">
          <Tag size={48} />
          <h3>No coupons created yet</h3>
          <p>Create your first campaign or promo code to reward customer loyalty.</p>
          <Button variant="primary" onClick={handleOpenCreate}>Create Coupon</Button>
        </div>
      ) : (
        <div className="admin-coupons-list">
          <div className="admin-coupons-table-wrapper">
            <table className="admin-coupons-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type & Value</th>
                  <th>Rules & Limits</th>
                  <th>Restrictions</th>
                  <th>Redemptions</th>
                  <th>Expiration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => {
                  const isExpired = coupon.expiration_date && new Date(coupon.expiration_date) < new Date();
                  const isFull = coupon.usage_limit && coupon.redemption_count >= coupon.usage_limit;
                  const hasRedemptions = coupon.redemption_count > 0;

                  return (
                    <tr key={coupon.coupon_id} className={coupon.status === 'inactive' ? 'admin-coupons-tr--inactive' : ''}>
                      <td>
                        <div className="admin-coupon-code-badge">
                          {coupon.coupon_code}
                        </div>
                      </td>
                      <td>
                        <span className="admin-coupon-type-label">
                          {coupon.coupon_type === 'percentage' && `${coupon.discount_value}% Off`}
                          {coupon.coupon_type === 'fixed' && `₹${coupon.discount_value} Off`}
                          {coupon.coupon_type === 'free_shipping' && 'Free Shipping'}
                        </span>
                        {coupon.coupon_type === 'percentage' && coupon.max_discount_amount && (
                          <div className="admin-coupon-meta-sub">
                            Max Cap: ₹{coupon.max_discount_amount}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="admin-coupon-meta-sub">Min Order: ₹{coupon.min_order_value || 0}</div>
                        <div className="admin-coupon-meta-sub">Per-User Limit: {coupon.per_user_limit}</div>
                      </td>
                      <td>
                        {coupon.categories?.length > 0 || coupon.products?.length > 0 ? (
                          <div className="admin-coupon-restrictions">
                            {coupon.categories?.map(c => (
                              <span key={c.category_id} className="admin-coupon-restrict-badge category">
                                Cat: {c.category_name}
                              </span>
                            ))}
                            {coupon.products?.map(p => (
                              <span key={p.product_id} className="admin-coupon-restrict-badge product">
                                Prod: {p.product_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="admin-coupon-restrict-badge global">Global (All products)</span>
                        )}
                      </td>
                      <td>
                        <div className="admin-coupon-redemptions">
                          <span className="count">{coupon.redemption_count}</span>
                          <span className="slash">/</span>
                          <span className="limit">{coupon.usage_limit || '∞'}</span>
                        </div>
                        {isFull && <span className="admin-coupon-badge--error">Limit Reached</span>}
                      </td>
                      <td>
                        {coupon.expiration_date ? (
                          <span className={`admin-coupon-expiry ${isExpired ? 'expired' : ''}`}>
                            {new Date(coupon.expiration_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="admin-coupon-expiry no-limit">No Expiry</span>
                        )}
                        {isExpired && <span className="admin-coupon-badge--error">Expired</span>}
                      </td>
                      <td>
                        <button
                          className={`admin-coupon-status-btn ${coupon.status}`}
                          onClick={() => handleToggleStatus(coupon)}
                          title="Toggle Active Status"
                        >
                          {coupon.status === 'active' ? (
                            <>
                              <Check size={12} />
                              Active
                            </>
                          ) : (
                            <>
                              <X size={12} />
                              Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td>
                        <div className="admin-coupon-actions">
                          <button
                            className="admin-coupon-action-btn"
                            onClick={() => handleOpenEdit(coupon)}
                            title="Edit settings"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="admin-coupon-modal-backdrop">
          <div className="admin-coupon-modal">
            <div className="admin-coupon-modal__header">
              <h3>{editingCoupon ? 'Edit Coupon Settings' : 'Create New Coupon'}</h3>
              <button className="admin-coupon-modal__close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="admin-coupon-modal__form">
              {editingCoupon && editingCoupon.redemption_count > 0 && (
                <div className="admin-coupon-mutation-alert">
                  <ShieldAlert size={16} />
                  <span>
                    This coupon has existing redemptions. To preserve immutable financial history, the Coupon Type and Discount Value cannot be modified.
                  </span>
                </div>
              )}

              <div className="admin-coupon-modal__grid">
                <div>
                  <label>Coupon Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. WELCOME10"
                    value={formData.coupon_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, coupon_code: e.target.value.toUpperCase() }))}
                    disabled={!!editingCoupon}
                  />
                </div>

                <div>
                  <label>Coupon Type *</label>
                  <select
                    value={formData.coupon_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, coupon_type: e.target.value }))}
                    disabled={!!editingCoupon && editingCoupon.redemption_count > 0}
                  >
                    <option value="fixed">Fixed Discount (₹)</option>
                    <option value="percentage">Percentage Discount (%)</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>

                <div>
                  <label>Discount Value *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    placeholder="E.g. 150"
                    value={formData.discount_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                    disabled={!!editingCoupon && editingCoupon.redemption_count > 0}
                  />
                </div>

                <div>
                  <label>Minimum Order Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.min_order_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_order_value: e.target.value }))}
                    disabled={!!editingCoupon}
                  />
                </div>

                <div>
                  <label>Maximum Discount Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Leave empty for unlimited"
                    value={formData.max_discount_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_discount_amount: e.target.value }))}
                    disabled={!!editingCoupon || formData.coupon_type !== 'percentage'}
                  />
                </div>

                <div>
                  <label>Global Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Total allowed uses"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value }))}
                  />
                </div>

                <div>
                  <label>Per-User Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.per_user_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, per_user_limit: e.target.value }))}
                  />
                </div>

                <div>
                  <label>Expiration Date</label>
                  <input
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiration_date: e.target.value }))}
                  />
                </div>

                <div>
                  <label>Campaign Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="active">Active (Can be redeemed)</option>
                    <option value="inactive">Inactive (Suspended)</option>
                  </select>
                </div>
              </div>

              {!editingCoupon && (
                <div className="admin-coupon-restrictions-selectors">
                  <h4 className="admin-coupon-restrict-heading">Optional Eligibility Restrictions (OR logic)</h4>
                  <p className="admin-coupon-restrict-sub">
                    If configured, the coupon only discounts products matching the selected categories OR products.
                  </p>

                  <div className="admin-coupon-restrict-split">
                    <div className="admin-coupon-restrict-section">
                      <h5>Restrict by Category</h5>
                      <div className="admin-coupon-restrict-checklist">
                        {categories.map(c => {
                          const isChecked = formData.category_ids.includes(c.category_id);
                          return (
                            <label key={c.category_id} className={`checklist-item ${isChecked ? 'active' : ''}`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleMultiSelectChange('category_ids', c.category_id)}
                              />
                              <span>{c.category_name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="admin-coupon-restrict-section">
                      <h5>Restrict by Specific Product</h5>
                      <div className="admin-coupon-restrict-checklist">
                        {products.map(p => {
                          const isChecked = formData.product_ids.includes(p.product_id);
                          return (
                            <label key={p.product_id} className={`checklist-item ${isChecked ? 'active' : ''}`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleMultiSelectChange('product_ids', p.product_id)}
                              />
                              <span>{p.product_name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="admin-coupon-modal__footer">
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={formLoading}>
                  {editingCoupon ? 'Save Changes' : 'Create Coupon'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
