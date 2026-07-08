import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  ClipboardList, 
  Search, 
  AlertTriangle, 
  History, 
  DollarSign, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpDown,
  RefreshCw,
  Sliders,
  CheckCircle,
  XCircle,
  Package
} from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

export default function Inventory() {
  useDocumentTitle('Inventory — ShopCart Admin');
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'alerts' | 'history'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Data states
  const [inventoryList, setInventoryList] = useState([]);
  const [valuation, setValuation] = useState({
    total_skus: 0,
    total_physical_items: 0,
    total_cost_value: 0,
    total_retail_value: 0,
    potential_gross_profit: 0,
    margin_percent: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);

  // Filter/Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'low_stock' | 'out_of_stock'

  // Modal states
  const [adjustModal, setAdjustModal] = useState({
    open: false,
    variantId: null,
    sku: '',
    productName: '',
    currentStock: 0,
    changeQty: '',
    reason: 'manual_adjustment'
  });

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [location.search]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [invData, valData, alertData, histData] = await Promise.all([
        adminService.getInventory(),
        adminService.getInventoryValue(),
        adminService.getAlerts(),
        adminService.getInventoryHistory(100) // fetch last 100 history logs
      ]);

      setInventoryList(invData);
      setValuation(valData);
      setAlerts(alertData);
      setHistory(histData);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch inventory dashboard data');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle stock adjustment modal opening
  const openAdjustModal = (variant) => {
    setAdjustModal({
      open: true,
      variantId: variant.variant_id,
      sku: variant.sku,
      productName: variant.product_name,
      currentStock: variant.available_stock,
      changeQty: '',
      reason: 'manual_adjustment'
    });
  };

  // Submit stock adjustment
  const handleAdjustStock = async (e) => {
    e.preventDefault();
    const qty = parseInt(adjustModal.changeQty, 10);
    
    if (isNaN(qty) || qty === 0) {
      showToast('error', 'Please enter a valid non-zero integer for stock change');
      return;
    }

    if (adjustModal.currentStock + qty < 0) {
      showToast('error', `Cannot adjust stock below 0. Available: ${adjustModal.currentStock}`);
      return;
    }

    try {
      setSubmitting(true);
      await adminService.adjustInventory(
        adjustModal.variantId,
        qty,
        adjustModal.reason
      );
      showToast('success', `Stock adjusted successfully for SKU ${adjustModal.sku}`);
      setAdjustModal(prev => ({ ...prev, open: false }));
      
      // Refresh inventory valuation and list
      await fetchData();
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to adjust stock');
      showToast('error', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle manually resolving alerts
  const handleResolveAlert = async (alertId) => {
    try {
      await adminService.resolveAlert(alertId);
      showToast('success', 'Alert resolved successfully');
      // Update local alerts state
      setAlerts(prev => prev.filter(a => a.alert_id !== alertId));
      
      // Update valuation/stats if needed
      const valData = await adminService.getInventoryValue();
      setValuation(valData);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to resolve alert');
      showToast('error', errMsg);
    }
  };

  // Filtering stock list
  const filteredInventory = inventoryList.filter(item => {
    const matchesSearch = 
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSupplier = 
      supplierFilter === 'all' || 
      String(item.supplier_id) === supplierFilter;

    const isLow = item.available_stock <= item.reorder_level;
    const isOut = item.available_stock === 0;

    const matchesStock = 
      stockFilter === 'all' ||
      (stockFilter === 'low_stock' && isLow) ||
      (stockFilter === 'out_of_stock' && isOut);

    return matchesSearch && matchesSupplier && matchesStock;
  });

  // Extract unique suppliers from inventory list for filters
  const uniqueSuppliers = Array.from(
    new Map(inventoryList.map(item => [item.supplier_id, { id: item.supplier_id, name: item.supplier_name }])).values()
  ).filter(s => s.id !== null);

  const getReasonLabel = (reason) => {
    const map = {
      purchase: 'Stock Purchase',
      sale: 'Customer Sale',
      cancellation: 'Order Cancellation',
      return: 'Customer Return',
      manual_adjustment: 'Manual Adjustment'
    };
    return map[reason] || reason;
  };

  const getAlertBadgeClass = (severity) => {
    if (severity === 'critical') return 'ap-badge--red';
    if (severity === 'warning') return 'ap-badge--yellow';
    return 'ap-badge--blue';
  };

  return (
    <div className="inventory-page">
      <header className="ap-header">
        <div>
          <h1 className="ap-title">Inventory Control</h1>
          <p className="ap-subtitle">Manage item variants stock levels, valuation, and movements ledger</p>
        </div>
        <button className="ap-btn ap-btn--ghost" onClick={fetchData} title="Refresh Inventory">
          <RefreshCw size={15} />
          <span>Refresh</span>
        </button>
      </header>

      {error && (
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)', marginBottom: '24px' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button className="ap-btn ap-btn--primary" onClick={fetchData} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="ap-loading">
          <Spinner size="lg" />
        </div>
      ) : !error && (
        <>
          {/* ── Valuation Grid ── */}
          <div className="ap-stats-grid inventory-page__valuation">
            {/* Total SKU */}
            <div className="ap-stat-card" style={{ '--stat-color': 'hsl(243, 75%, 65%)', '--stat-bg': 'hsla(243,75%,65%,0.1)' }}>
              <div className="ap-stat-card__top">
                <span className="ap-stat-card__label">Total SKUs</span>
                <div className="ap-stat-card__icon"><Layers size={20} /></div>
              </div>
              <div className="ap-stat-card__value">{valuation.total_skus}</div>
              <p className="inventory-page__val-meta">Distinct product variants</p>
            </div>

            {/* Total Stock */}
            <div className="ap-stat-card" style={{ '--stat-color': 'hsl(198, 85%, 48%)', '--stat-bg': 'hsla(198,85%,48%,0.1)' }}>
              <div className="ap-stat-card__top">
                <span className="ap-stat-card__label">Physical Stock</span>
                <div className="ap-stat-card__icon"><Package size={20} /></div>
              </div>
              <div className="ap-stat-card__value">{valuation.total_physical_items}</div>
              <p className="inventory-page__val-meta">Total units in inventory</p>
            </div>

            {/* Total Cost Value */}
            <div className="ap-stat-card" style={{ '--stat-color': 'hsl(38, 88%, 52%)', '--stat-bg': 'hsla(38,88%,52%,0.1)' }}>
              <div className="ap-stat-card__top">
                <span className="ap-stat-card__label">Asset Value (Cost)</span>
                <div className="ap-stat-card__icon"><DollarSign size={20} /></div>
              </div>
              <div className="ap-stat-card__value">₹{Number(valuation.total_cost_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <p className="inventory-page__val-meta">Calculated using buy prices</p>
            </div>

            {/* Total Retail Value */}
            <div className="ap-stat-card" style={{ '--stat-color': 'hsl(162, 73%, 46%)', '--stat-bg': 'hsla(162,73%,46%,0.1)' }}>
              <div className="ap-stat-card__top">
                <span className="ap-stat-card__label">Retail Value</span>
                <div className="ap-stat-card__icon"><TrendingUp size={20} /></div>
              </div>
              <div className="ap-stat-card__value">₹{Number(valuation.total_retail_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <p className="inventory-page__val-meta">Selling catalog potential</p>
            </div>

            {/* Gross Profit Margin */}
            <div className="ap-stat-card" style={{ '--stat-color': 'hsl(270, 72%, 68%)', '--stat-bg': 'hsla(270,72%,68%,0.1)' }}>
              <div className="ap-stat-card__top">
                <span className="ap-stat-card__label">Est. Gross Margin</span>
                <div className="ap-stat-card__icon"><CheckCircle size={20} /></div>
              </div>
              <div className="ap-stat-card__value">
                {(valuation.margin_percent !== undefined && valuation.margin_percent !== null && valuation.total_retail_value > 0)
                  ? `${valuation.margin_percent}%`
                  : 'N/A'}
              </div>
              <p className="inventory-page__val-meta">Avg. retail to cost ratio</p>
            </div>
          </div>

          {/* ── Tabs Navigation ── */}
          <div className="inventory-page__tabs">
            <button 
              className={`inventory-page__tab ${activeTab === 'stock' ? 'inventory-page__tab--active' : ''}`}
              onClick={() => setActiveTab('stock')}
            >
              <ClipboardList size={16} />
              <span>Stock Inventory</span>
            </button>
            <button 
              className={`inventory-page__tab ${activeTab === 'alerts' ? 'inventory-page__tab--active' : ''}`}
              onClick={() => setActiveTab('alerts')}
            >
              <AlertTriangle size={16} />
              <span>Active Alerts</span>
              {alerts.length > 0 && (
                <span className="inventory-page__tab-badge">{alerts.length}</span>
              )}
            </button>
            <button 
              className={`inventory-page__tab ${activeTab === 'history' ? 'inventory-page__tab--active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={16} />
              <span>Stock Movements ledger</span>
            </button>
          </div>

          {/* ── TAB CONTENT ── */}
          <div className="inventory-page__content">
            
            {/* ── STOCK LIST TAB ── */}
            {activeTab === 'stock' && (
              <div className="ap-card">
                {/* Filters */}
                <div className="inventory-page__toolbar">
                  <div className="inventory-page__search">
                    <Search className="inventory-page__search-icon" size={18} />
                    <input
                      type="text"
                      placeholder="Search variants name or SKU..."
                      className="ap-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="inventory-page__filters">
                    <select
                      className="ap-select"
                      value={supplierFilter}
                      onChange={(e) => setSupplierFilter(e.target.value)}
                    >
                      <option value="all">All Suppliers</option>
                      {uniqueSuppliers.map(sup => (
                        <option key={sup.id} value={sup.id}>{sup.name}</option>
                      ))}
                    </select>

                    <select
                      className="ap-select"
                      value={stockFilter}
                      onChange={(e) => setStockFilter(e.target.value)}
                    >
                      <option value="all">All Stocks</option>
                      <option value="low_stock">Low Stock Alerts</option>
                      <option value="out_of_stock">Out of Stock</option>
                    </select>
                    
                    <span className="inventory-page__count">
                      Showing {filteredInventory.length} variants
                    </span>
                  </div>
                </div>

                {/* Table */}
                {filteredInventory.length === 0 ? (
                  <div className="ap-empty">
                    <p>No inventory variants found matching filters.</p>
                  </div>
                ) : (
                  <div className="ap-table-wrap">
                    <table className="ap-table">
                      <thead>
                        <tr>
                          <th>SKU / Product</th>
                          <th>Size / Color</th>
                          <th>Supplier</th>
                          <th>Purchase Cost</th>
                          <th>Retail Price</th>
                          <th style={{ textAlign: 'center' }}>Stock Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventory.map((item) => {
                          const isOut = item.available_stock === 0;
                          const isLow = item.available_stock <= item.reorder_level;
                          
                          let stockClass = 'inventory-page__stock-status--ok';
                          let badgeText = 'Healthy';
                          if (isOut) {
                            stockClass = 'inventory-page__stock-status--out';
                            badgeText = 'Out of Stock';
                          } else if (isLow) {
                            stockClass = 'inventory-page__stock-status--low';
                            badgeText = 'Low Stock';
                          }

                          return (
                            <tr key={item.variant_id}>
                              <td>
                                <div>
                                  <div className="inventory-page__sku">{item.sku}</div>
                                  <div className="inventory-page__prod-name">{item.product_name}</div>
                                  <span className="inventory-page__cat">{item.category_name || 'Others'}</span>
                                </div>
                              </td>
                              <td>
                                <div>
                                  <div>Size: <span style={{ fontWeight: '600' }}>{item.size || '—'}</span></div>
                                  <div>Color: <span style={{ fontWeight: '600' }}>{item.color || 'Default'}</span></div>
                                </div>
                              </td>
                              <td style={{ fontSize: '13px' }}>{item.supplier_name || '—'}</td>
                              <td>₹{Number(item.purchase_price || 0).toLocaleString('en-IN')}</td>
                              <td>
                                <div>
                                  ₹{Number(item.price_override ?? item.base_selling_price ?? 0).toLocaleString('en-IN')}
                                  {item.price_override !== null && (
                                    <span className="inventory-page__override-tag" title="Price Override active">Override</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                  <span className={`inventory-page__stock-qty ${isOut ? 'qty--out' : isLow ? 'qty--low' : 'qty--ok'}`} style={{ fontWeight: '700' }}>
                                    {item.available_stock} Units
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                    Reorder at {item.reorder_level}
                                  </span>
                                  <span className={`inventory-page__stock-badge ${stockClass}`}>{badgeText}</span>
                                </div>
                              </td>
                              <td>
                                <div className="ap-actions">
                                  <button
                                    className="ap-btn ap-btn--primary"
                                    onClick={() => openAdjustModal(item)}
                                    title="Adjust Stock Quantity"
                                  >
                                    <Sliders size={14} />
                                    <span>Adjust</span>
                                  </button>
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

            {/* ── ACTIVE ALERTS TAB ── */}
            {activeTab === 'alerts' && (
              <div className="ap-card">
                <p className="inventory-page__sec-desc">
                  Low stock levels, stock depletion, and critical logistics alerts.
                </p>
                {alerts.length === 0 ? (
                  <div className="ap-empty">
                    <p>Great! No unresolved stock alerts at the moment.</p>
                  </div>
                ) : (
                  <div className="inventory-page__alerts-list">
                    {alerts.map((alert) => (
                      <div key={alert.alert_id} className={`inventory-page__alert-item alert-border--${alert.severity}`}>
                        <div className="inventory-page__alert-main">
                          <div className="inventory-page__alert-icon" style={{ 
                            color: alert.severity === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)' 
                          }}>
                            <AlertTriangle size={20} />
                          </div>
                          <div className="inventory-page__alert-body">
                            <div className="inventory-page__alert-msg">{alert.message}</div>
                            <div className="inventory-page__alert-meta">
                              <span>SKU: {alert.sku || '—'}</span>
                              <span className="bullet-sep">•</span>
                              <span>Product: {alert.product_name || '—'}</span>
                              <span className="bullet-sep">•</span>
                              <span>Triggered: {new Date(alert.created_at).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="inventory-page__alert-actions">
                          {alert.variant_id && (
                            <button
                              className="ap-btn ap-btn--primary"
                              onClick={() => {
                                const variant = inventoryList.find(v => v.variant_id === alert.variant_id);
                                if (variant) openAdjustModal(variant);
                                else showToast('error', 'Variant not found in inventory list');
                              }}
                            >
                              <Sliders size={13} />
                              <span>Restock</span>
                            </button>
                          )}
                          <button
                            className="ap-btn ap-btn--ghost"
                            onClick={() => handleResolveAlert(alert.alert_id)}
                          >
                            <span>Mark Resolved</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── STOCK HISTORY TAB ── */}
            {activeTab === 'history' && (
              <div className="ap-card">
                <p className="inventory-page__sec-desc">
                  Audit log of all stock increments, decrements, checkout transactions, cancellations and manual entries.
                </p>
                {history.length === 0 ? (
                  <div className="ap-empty">
                    <p>No inventory movements recorded in history.</p>
                  </div>
                ) : (
                  <div className="ap-table-wrap">
                    <table className="ap-table">
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>SKU / Product</th>
                          <th style={{ textAlign: 'center' }}>Adjustment</th>
                          <th>Reason Category</th>
                          <th>Attribution (By)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((log) => {
                          const isPositive = log.change > 0;
                          return (
                            <tr key={log.movement_id}>
                              <td style={{ fontSize: '13px' }}>
                                {new Date(log.created_at).toLocaleString('en-IN')}
                              </td>
                              <td>
                                <div>
                                  <div className="inventory-page__sku">{log.sku}</div>
                                  <div className="inventory-page__prod-name" style={{ fontSize: '13px' }}>{log.product_name}</div>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  <span className={`inventory-page__ledger-change ${isPositive ? 'ledger--plus' : 'ledger--minus'}`}>
                                    {isPositive ? '+' : ''}{log.change}
                                    {isPositive ? <TrendingUp size={14} style={{ marginLeft: '4px' }} /> : <TrendingDown size={14} style={{ marginLeft: '4px' }} />}
                                  </span>
                                </div>
                              </td>
                              <td style={{ fontWeight: '500', fontSize: '13px' }}>
                                {getReasonLabel(log.reason)}
                              </td>
                              <td style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                {log.created_by || 'system'}
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
        </>
      )}

      {/* ── STOCK ADJUSTMENT MODAL ── */}
      {adjustModal.open && (
        <div className="inventory-modal">
          <div className="inventory-modal__overlay" onClick={() => setAdjustModal(prev => ({ ...prev, open: false }))}></div>
          <div className="inventory-modal__card ap-card">
            <h3 className="inventory-modal__title">Adjust Stock Level</h3>
            <p className="inventory-modal__subtitle">
              SKU: <strong style={{ color: 'var(--color-primary)' }}>{adjustModal.sku}</strong> <br />
              Product: <strong>{adjustModal.productName}</strong>
            </p>
            
            <form onSubmit={handleAdjustStock}>
              <div className="ap-field">
                <label className="ap-label">Current Stock</label>
                <input
                  type="text"
                  className="ap-input"
                  disabled
                  value={adjustModal.currentStock}
                />
              </div>

              <div className="ap-field">
                <label className="ap-label">Change Quantity *</label>
                <input
                  type="number"
                  className="ap-input"
                  required
                  disabled={submitting}
                  placeholder="e.g. 50 (adds stock) or -10 (removes stock)"
                  value={adjustModal.changeQty}
                  onChange={(e) => setAdjustModal(prev => ({ ...prev, changeQty: e.target.value }))}
                />
                <span className="inventory-page__form-hint">
                  Use positive numbers to add inventory, and negative numbers to subtract stock.
                </span>
              </div>

              <div className="ap-field">
                <label className="ap-label">Reason *</label>
                <select
                  className="ap-select"
                  required
                  disabled={submitting}
                  value={adjustModal.reason}
                  onChange={(e) => setAdjustModal(prev => ({ ...prev, reason: e.target.value }))}
                >
                  <option value="manual_adjustment">Manual Adjustment / Rectification</option>
                  <option value="purchase">Stock Purchase / Restocking</option>
                  <option value="cancellation">Return / Cancellation Recovery</option>
                  <option value="return">Customer Refund / Return Return</option>
                  <option value="sale">Damage / Shrinkage Write-off</option>
                </select>
              </div>

              <div className="inventory-modal__actions">
                <button
                  type="button"
                  className="ap-btn ap-btn--ghost"
                  disabled={submitting}
                  onClick={() => setAdjustModal(prev => ({ ...prev, open: false }))}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ap-btn ap-btn--primary"
                  disabled={submitting}
                >
                  {submitting ? <Spinner size="sm" /> : <span>Confirm Change</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
