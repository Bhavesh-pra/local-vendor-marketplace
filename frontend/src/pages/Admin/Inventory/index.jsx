import { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  RefreshCw, 
  Package, 
  ArrowRightLeft,
  ChevronRight,
  User,
  Calendar,
  Layers
} from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

export default function Inventory() {
  useDocumentTitle('Inventory Control — ShopCart Admin');
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Lists
  const [variants, setVariants] = useState([]);
  const [history, setHistory] = useState([]);

  // Selected state
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedVariant, setSelectedVariant] = useState(null);

  // Form states
  const [movementType, setMovementType] = useState('SUPPLIER_RESTOCK');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch initial variant list
  const fetchVariants = async (autoSelectId = null) => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getInventory();
      setVariants(data);
      
      if (data.length > 0) {
        // If an autoSelectId is specified, try to find it, otherwise select the first item
        const defaultId = autoSelectId || data[0].variant_id;
        setSelectedVariantId(defaultId);
      }
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch product variants');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVariants();
  }, []);

  // Sync selected variant data and fetch history
  useEffect(() => {
    if (!selectedVariantId) {
      setSelectedVariant(null);
      setHistory([]);
      return;
    }

    const variantObj = variants.find(v => String(v.variant_id) === String(selectedVariantId));
    setSelectedVariant(variantObj || null);

    // Fetch history logs
    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        const histData = await adminService.getInventoryHistoryByVariant(selectedVariantId);
        setHistory(histData);
      } catch (err) {
        console.error('Failed to fetch history:', err.message);
        showToast('error', 'Failed to load stock movement ledger');
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [selectedVariantId, variants]);

  // Handle manual adjustment submission
  const handleSubmitAdjustment = async (e) => {
    e.preventDefault();

    if (!selectedVariantId) {
      showToast('error', 'Please select a variant first');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('error', 'Quantity must be a positive integer greater than 0');
      return;
    }

    const isPositive = [
      'SUPPLIER_RESTOCK',
      'ORDER_CANCELLATION_RESTOCK',
      'RETURN_RESTOCK'
    ].includes(movementType);

    const change = isPositive ? qty : -qty;
    const currentStock = selectedVariant ? selectedVariant.available_stock : 0;
    const projectedStock = currentStock + change;

    if (projectedStock < 0) {
      showToast('error', `Adjustment would cause negative stock level (${projectedStock}). Cancelled.`);
      return;
    }

    if (['MANUAL_CORRECTION', 'DAMAGED'].includes(movementType)) {
      if (!notes || notes.trim().length < 10) {
        showToast('error', 'Justification note must be at least 10 characters long.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await adminService.adjustInventory(
        selectedVariantId,
        movementType,
        qty,
        notes.trim()
      );

      showToast('success', `Stock successfully adjusted to ${res.newStock} units`);
      
      // Reset form fields
      setQuantity('');
      setNotes('');

      // Reload variant list and preserve selection to refresh current stock and history
      await fetchVariants(selectedVariantId);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Stock adjustment failed');
      showToast('error', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper labels
  const getMovementBadgeClass = (type) => {
    const maps = {
      SUPPLIER_RESTOCK: 'ap-badge--green',
      ORDER_CANCELLATION_RESTOCK: 'ap-badge--green',
      RETURN_RESTOCK: 'ap-badge--green',
      DAMAGED: 'ap-badge--red',
      MANUAL_CORRECTION: 'ap-badge--blue',
      INTERNAL_USAGE: 'ap-badge--yellow',
      ORDER_SALE: 'ap-badge--purple'
    };
    return maps[type] || 'ap-badge--gray';
  };

  const getMovementLabel = (type) => {
    const maps = {
      SUPPLIER_RESTOCK: 'Supplier Restock',
      ORDER_CANCELLATION_RESTOCK: 'Cancellation Recovery',
      RETURN_RESTOCK: 'Customer Return Restock',
      DAMAGED: 'Damaged Stock',
      MANUAL_CORRECTION: 'Manual Adjustment',
      INTERNAL_USAGE: 'Internal Sample Usage',
      ORDER_SALE: 'Customer Sale'
    };
    return maps[type] || type;
  };

  return (
    <div className="inventory-page">
      <header className="ap-header">
        <div>
          <h1 className="ap-title">Inventory Operations</h1>
          <p className="ap-subtitle">Controlled audit-logged inventory adjustments and transaction history</p>
        </div>
        <button 
          className="ap-btn ap-btn--ghost min-touch-target" 
          onClick={() => fetchVariants(selectedVariantId)} 
          title="Refresh Variants"
          disabled={loading || submitting}
        >
          <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
          <span>Refresh</span>
        </button>
      </header>

      {error && (
        <div className="ap-card ap-empty" style={{ borderColor: 'var(--color-danger)' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button className="ap-btn ap-btn--primary min-touch-target" onClick={() => fetchVariants()}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="ap-loading">
          <Spinner size="lg" />
        </div>
      ) : !error && (
        <div className="inventory-page__grid">
          {/* Left card: Control Panel */}
          <div className="ap-card inventory-page__control-card">
            <div className="inventory-page__card-header">
              <Package size={20} className="header-icon" />
              <h3>Stock Adjustment Panel</h3>
            </div>
            
            <form onSubmit={handleSubmitAdjustment} className="inventory-page__form">
              <div className="ap-field">
                <label className="ap-label">Select Variant *</label>
                <select
                  className="ap-select min-touch-target"
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  disabled={submitting}
                  required
                >
                  {variants.map(v => (
                    <option key={v.variant_id} value={v.variant_id}>
                      {v.sku} — {v.product_name} ({v.size || 'No Size'} / {v.color || 'DefaultColor'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="ap-field">
                <label className="ap-label">Adjustment Type *</label>
                <select
                  className="ap-select min-touch-target"
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value)}
                  disabled={submitting}
                  required
                >
                  <option value="SUPPLIER_RESTOCK">SUPPLIER_RESTOCK (Positive)</option>
                  <option value="ORDER_CANCELLATION_RESTOCK">ORDER_CANCELLATION_RESTOCK (Positive)</option>
                  <option value="RETURN_RESTOCK">RETURN_RESTOCK (Positive)</option>
                  <option value="DAMAGED">DAMAGED (Negative)</option>
                  <option value="MANUAL_CORRECTION">MANUAL_CORRECTION (Negative)</option>
                  <option value="INTERNAL_USAGE">INTERNAL_USAGE (Negative)</option>
                </select>
                <span className="inventory-page__form-hint">
                  System types such as ORDER_SALE cannot be triggered manually.
                </span>
              </div>

              <div className="ap-field">
                <label className="ap-label">Quantity *</label>
                <input
                  type="number"
                  className="ap-input min-touch-target"
                  min="1"
                  required
                  placeholder="Enter a positive integer"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="ap-field">
                <label className="ap-label">Notes / Justification</label>
                <textarea
                  className="ap-input min-touch-target"
                  rows="3"
                  placeholder="Provide reference or correction reason..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={submitting}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                className="ap-btn ap-btn--primary min-touch-target"
                disabled={submitting || !selectedVariantId}
                style={{ width: '100%', marginTop: '8px' }}
              >
                {submitting ? <Spinner size="sm" /> : <span>Apply Stock Adjustment</span>}
              </button>
            </form>
          </div>

          {/* Right card: Variant Detail & Audit Ledger */}
          <div className="inventory-page__ledger-card">
            {selectedVariant ? (
              <>
                <div className="ap-card inventory-page__detail-summary">
                  <div className="inventory-page__detail-metric">
                    <span className="label">Current Available Stock</span>
                    <span className={`value ${selectedVariant.available_stock === 0 ? 'qty--out' : selectedVariant.available_stock <= selectedVariant.reorder_level ? 'qty--low' : 'qty--ok'}`}>
                      {selectedVariant.available_stock} Units
                    </span>
                  </div>

                  <div className="inventory-page__detail-metric">
                    <span className="label">Last Restocked</span>
                    <span className="value-sub">
                      {selectedVariant.last_restock_date ? (
                        <>
                          <Calendar size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                          {new Date(selectedVariant.last_restock_date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </>
                      ) : 'Never restocked'}
                    </span>
                  </div>
                </div>

                <div className="ap-card inventory-page__history-container">
                  <div className="inventory-page__card-header">
                    <ClipboardList size={20} className="header-icon" />
                    <h3>Variant Audit Ledger</h3>
                  </div>

                  {historyLoading ? (
                    <div className="ap-loading" style={{ minHeight: '150px' }}>
                      <Spinner size="md" />
                    </div>
                  ) : history.length === 0 ? (
                    <div className="ap-empty">
                      <p>No stock movement logs recorded for this variant.</p>
                    </div>
                  ) : (
                    <div className="ap-table-wrap">
                      <table className="ap-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Variant</th>
                            <th>Movement Type</th>
                            <th style={{ textAlign: 'center' }}>Change</th>
                            <th style={{ textAlign: 'center' }}>Prev Stock</th>
                            <th style={{ textAlign: 'center' }}>New Stock</th>
                            <th>Actor</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((log) => {
                            const isPositive = log.quantity_change > 0;
                            return (
                              <tr key={log.movement_id}>
                                <td style={{ fontSize: '12px' }}>
                                  {new Date(log.created_at).toLocaleString('en-IN', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td>
                                  <div>
                                    <div className="inventory-page__sku-tag">{log.sku}</div>
                                  </div>
                                </td>
                                <td>
                                  <span className={`ap-badge ${getMovementBadgeClass(log.movement_type)}`}>
                                    {getMovementLabel(log.movement_type)}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <span className={`ledger-change-val ${isPositive ? 'plus' : 'minus'}`}>
                                      {isPositive ? '+' : ''}{log.quantity_change}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: '500' }}>{log.previous_quantity}</td>
                                <td style={{ textAlign: 'center', fontWeight: '600' }}>{log.new_quantity}</td>
                                <td style={{ fontSize: '13px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <User size={12} style={{ color: 'var(--color-text-muted)' }} />
                                    <span>{log.actor_username || 'system'}</span>
                                  </div>
                                </td>
                                <td style={{ fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.notes}>
                                  {log.notes || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="ap-card ap-empty">
                <p>Select a product variant to view details and history audit ledger.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
