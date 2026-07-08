import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Edit2, EyeOff, Eye, ClipboardList, Archive, Package, Copy } from 'lucide-react';
import { adminService } from '../../../../services/adminService.js';
import { ROUTES } from '../../../../constants/routes.js';
import { useToast } from '../../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../../utils/extractErrorMessage.js';
import './index.css';

export default function ProductList() {
  useDocumentTitle('Products — ShopCart Admin');
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeMenuId, setActiveMenuId] = useState(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllProducts();
      setProducts(data);
      setError(null);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch products');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Dropdown closing logic
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.products-dropdown-container')) {
        setActiveMenuId(null);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await adminService.setProductStatus(id, newStatus);
      showToast('success', `Product status set to ${newStatus}`);
      // update local state
      setProducts(prev =>
        prev.map(p => (p.product_id === id ? { ...p, product_status: newStatus } : p))
      );
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to update product status');
      showToast('error', errMsg);
    }
  };

  const handleArchiveProduct = async (id) => {
    if (!window.confirm('Are you sure you want to archive this product? This will permanently remove it from active catalog views.')) {
      return;
    }
    try {
      await adminService.setProductStatus(id, 'archived');
      showToast('success', 'Product archived successfully');
      setProducts(prev => prev.filter(p => p.product_id !== id));
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to archive product');
      showToast('error', errMsg);
    }
  };

  const handleDuplicateProduct = async (id) => {
    try {
      const res = await adminService.duplicateProduct(id);
      showToast('success', 'Product duplicated successfully as Draft!');
      fetchProducts();
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to duplicate product');
      showToast('error', errMsg);
    }
  };

  const filteredProducts = products.filter(p => {
    if (p.product_status === 'archived') return false;
    const matchesSearch = p.product_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && p.product_status === 'active') ||
      (statusFilter === 'inactive' && p.product_status === 'inactive');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="product-list">
      <header className="ap-header">
        <div>
          <h1 className="ap-title">Products</h1>
          <p className="ap-subtitle">Manage catalog, pricing, stock and visibility</p>
        </div>
        <Link to={ROUTES.ADMIN_PRODUCTS_CREATE} className="ap-btn ap-btn--primary">
          <Plus size={16} />
          <span>Add Product</span>
        </Link>
      </header>

      {error && (
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button className="ap-btn ap-btn--primary" onClick={fetchProducts} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="ap-loading">
          <Spinner size="lg" />
        </div>
      ) : !error && (
        <div className="ap-card">
          <div className="product-list__toolbar">
            <div className="product-list__search">
              <Search className="product-list__search-icon" size={18} />
              <input
                type="text"
                placeholder="Search products..."
                className="ap-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="product-list__filters">
              <select
                className="ap-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <span className="product-list__count">
                Showing {filteredProducts.length} of {products.length} products
              </span>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="ap-empty" style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Package size={40} style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }} />
              <p className="ap-empty__title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text-heading)' }}>No products available.</p>
              <p className="ap-empty__desc" style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>Add Product.</p>
              <Link to={ROUTES.ADMIN_PRODUCTS_CREATE} className="ap-btn ap-btn--primary">
                <Plus size={16} />
                <span>Add Product</span>
              </Link>
            </div>
          ) : (
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>Variants</th>
                    <th style={{ textAlign: 'center' }}>Total Stock</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const isOut = p.stock === 0;
                    const isLowStock = p.stock < 10;
                    return (
                      <tr key={p.product_id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img
                              src={p.image_url || '/placeholder-product.svg'}
                              alt={p.product_name}
                              className="product-list__thumb"
                              onError={(e) => {
                                e.target.src = '/placeholder-product.svg';
                              }}
                            />
                            <div>
                              <div className="product-list__name">{p.product_name}</div>
                              {p.size_or_quantity && (
                                <span className="product-list__meta">{p.size_or_quantity}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{p.category_name || 'Others'}</td>
                        <td style={{ textAlign: 'center', fontWeight: '600' }}>
                          {p.variants_count || 1} variant(s)
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--color-text)' }}>
                              {p.stock} units
                            </span>
                            {isOut ? (
                              <span className="ap-badge ap-badge--red" style={{ fontSize: '10px', padding: '2px 8px' }}>Out of Stock</span>
                            ) : isLowStock ? (
                              <span className="ap-badge ap-badge--yellow" style={{ fontSize: '10px', padding: '2px 8px' }}>Low Stock</span>
                            ) : (
                              <span className="ap-badge ap-badge--green" style={{ fontSize: '10px', padding: '2px 8px' }}>Healthy</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`ap-badge ${
                              p.product_status === 'active' ? 'ap-badge--green' :
                              p.product_status === 'draft' ? 'ap-badge--yellow' : 'ap-badge--red'
                            }`}
                          >
                            {p.product_status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div className="ap-actions" style={{ justifyContent: 'flex-end' }}>
                            <Link
                              to={`/admin/products/${p.product_id}/edit`}
                              className="ap-btn ap-btn--ghost"
                              title="Edit Product"
                            >
                              <Edit2 size={14} />
                              <span>Edit</span>
                            </Link>
                            <Link
                              to={`${ROUTES.ADMIN_INVENTORY}?search=${encodeURIComponent(p.product_name)}`}
                              className="ap-btn ap-btn--ghost"
                              title="View Inventory Details"
                            >
                              <ClipboardList size={14} />
                              <span>Inventory</span>
                            </Link>
                            
                            <div className="products-dropdown-container" style={{ position: 'relative' }}>
                              <button
                                className="ap-btn ap-btn--ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === p.product_id ? null : p.product_id);
                                }}
                                title="More Actions"
                                style={{ minWidth: '40px', justifyContent: 'center' }}
                              >
                                <span>⋮ More</span>
                              </button>
                              
                              {activeMenuId === p.product_id && (
                                <div className="products-dropdown-menu">
                                  <button
                                    className="dropdown-item"
                                    onClick={() => {
                                      handleToggleStatus(p.product_id, p.product_status);
                                      setActiveMenuId(null);
                                    }}
                                  >
                                    {p.product_status === 'active' ? (
                                      <>
                                        <EyeOff size={13} />
                                        <span>Hide</span>
                                      </>
                                    ) : (
                                      <>
                                        <Eye size={13} />
                                        <span>Show</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    className="dropdown-item"
                                    onClick={() => {
                                      handleDuplicateProduct(p.product_id);
                                      setActiveMenuId(null);
                                    }}
                                  >
                                    <Copy size={13} />
                                    <span>Duplicate</span>
                                  </button>
                                  <button
                                    className="dropdown-item text-danger"
                                    onClick={() => {
                                      handleArchiveProduct(p.product_id);
                                      setActiveMenuId(null);
                                    }}
                                  >
                                    <Archive size={13} />
                                    <span>Archive</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
