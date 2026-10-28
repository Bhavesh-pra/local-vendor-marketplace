import { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Send, 
  Check, 
  X, 
  ArrowRight, 
  Eye, 
  Clipboard,
  Calendar,
  Layers,
  ChevronRight,
  User,
  DollarSign
} from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

export default function AdminPurchaseOrders() {
  useDocumentTitle('Purchase Orders — ShopCart Admin');
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Data lists
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventoryVariants, setInventoryVariants] = useState([]);

  // Selected state
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [selectedPo, setSelectedPo] = useState(null);

  // New PO Form states
  const [isCreating, setIsCreating] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newItems, setNewItems] = useState([{ variant_id: '', ordered_quantity: '', unit_cost: '' }]);

  // Receive stock Form states
  const [isReceiving, setIsReceiving] = useState(false);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiveQuantities, setReceiveQuantities] = useState({}); // { variant_id: quantity }

  // Fetch initial POs & metadata
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { purchaseOrders: pos, suppliers: sups } = await adminService.getPurchaseOrders();
      setPurchaseOrders(pos);
      setSuppliers(sups);

      const inv = await adminService.getInventory();
      setInventoryVariants(inv);

      if (pos.length > 0 && !selectedPoId) {
        setSelectedPoId(pos[0].po_id);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to fetch purchase orders.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch PO detail
  useEffect(() => {
    if (selectedPoId) {
      adminService.getPurchaseOrderDetails(selectedPoId)
        .then(data => {
          setSelectedPo(data);
          // Initialize receive quantities
          const initialQtys = {};
          data.items.forEach(item => {
            const remaining = item.ordered_quantity - item.received_quantity;
            initialQtys[item.variant_id] = remaining > 0 ? remaining : '';
          });
          setReceiveQuantities(initialQtys);
        })
        .catch(err => {
          showToast('error', extractErrorMessage(err, 'Failed to load PO details.'));
        });
    } else {
      setSelectedPo(null);
    }
  }, [selectedPoId]);

  // Handle new item row addition
  const handleAddItemRow = () => {
    setNewItems(prev => [...prev, { variant_id: '', ordered_quantity: '', unit_cost: '' }]);
  };

  // Handle item row removal
  const handleRemoveItemRow = (index) => {
    if (newItems.length === 1) return;
    setNewItems(prev => prev.filter((_, i) => i !== index));
  };

  // Handle item change
  const handleItemChange = (index, field, value) => {
    setNewItems(prev => {
      const copy = [...prev];
      copy[index][field] = value;
      // Auto-populate unit cost if variant is selected
      if (field === 'variant_id') {
        const selectedVariant = inventoryVariants.find(v => v.variant_id === parseInt(value, 10));
        if (selectedVariant && selectedVariant.purchase_price) {
          copy[index]['unit_cost'] = selectedVariant.purchase_price;
        }
      }
      return copy;
    });
  };

  // Submit new PO
  const handleCreatePoSubmit = async (e) => {
    e.preventDefault();

    if (!newSupplierId) {
      showToast('error', 'Supplier is required');
      return;
    }

    const payloadItems = [];
    for (const item of newItems) {
      if (!item.variant_id) {
        showToast('error', 'All items must have a variant selected');
        return;
      }
      const qty = parseInt(item.ordered_quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        showToast('error', 'Ordered quantity must be a positive integer');
        return;
      }
      const cost = parseFloat(item.unit_cost);
      if (isNaN(cost) || cost < 0) {
        showToast('error', 'Unit cost must be a non-negative decimal');
        return;
      }
      payloadItems.push({
        variant_id: parseInt(item.variant_id, 10),
        ordered_quantity: qty,
        unit_cost: cost
      });
    }

    try {
      setSubmitting(true);
      const res = await adminService.createPurchaseOrder({
        supplier_id: parseInt(newSupplierId, 10),
        notes: newNotes.trim(),
        items: payloadItems
      });

      showToast('success', res.message || 'Purchase order created successfully!');
      
      // Reset form
      setIsCreating(false);
      setNewSupplierId('');
      setNewNotes('');
      setNewItems([{ variant_id: '', ordered_quantity: '', unit_cost: '' }]);
      
      // Reload lists and set selection to new PO
      setSelectedPoId(res.po_id);
      fetchData();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to create purchase order.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Transition PO Status (Send or Cancel)
  const handleTransitionStatus = async (status) => {
    if (!selectedPoId) return;
    try {
      setSubmitting(true);
      const res = await adminService.updatePurchaseOrderStatus(selectedPoId, status);
      showToast('success', res.message || `PO transitioned to ${status}`);
      fetchData();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Status transition failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Receive stock quantities
  const handleReceiveStock = async (e) => {
    e.preventDefault();
    if (!selectedPo) return;

    const payloadItems = [];
    for (const key of Object.keys(receiveQuantities)) {
      const qtyStr = receiveQuantities[key];
      if (qtyStr === '' || qtyStr === 0) continue; // Skip zero/empty items

      const qty = parseInt(qtyStr, 10);
      if (isNaN(qty) || qty < 0) {
        showToast('error', 'Received quantities must be positive integers');
        return;
      }

      payloadItems.push({
        variant_id: parseInt(key, 10),
        quantity: qty
      });
    }

    if (payloadItems.length === 0) {
      showToast('error', 'Please enter at least one quantity to receive');
      return;
    }

    try {
      setSubmitting(true);
      const res = await adminService.receivePurchaseOrderInventory(selectedPo.po_id, {
        items: payloadItems,
        notes: receiveNotes.trim()
      });

      showToast('success', res.message || 'Stock successfully received');
      setReceiveNotes('');
      setIsReceiving(false);
      fetchData();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Inventory receipt failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Render status helper
  const renderStatusBadge = (status) => {
    let colorClass = '';
    switch (status) {
      case 'DRAFT': colorClass = 'po-badge--draft'; break;
      case 'SENT': colorClass = 'po-badge--sent'; break;
      case 'ACKNOWLEDGED': colorClass = 'po-badge--acknowledged'; break;
      case 'PARTIALLY_RECEIVED': colorClass = 'po-badge--partial'; break;
      case 'RECEIVED': colorClass = 'po-badge--received'; break;
      case 'CANCELLED': colorClass = 'po-badge--cancelled'; break;
    }
    return <span className={`po-badge ${colorClass}`}>{status}</span>;
  };

  if (loading && purchaseOrders.length === 0) {
    return (
      <div className="po-loader">
        <Spinner size="lg" />
        <p>Loading procurement registry...</p>
      </div>
    );
  }

  return (
    <div className="po-container">
      {/* Page Header */}
      <div className="po-header">
        <div>
          <h1 className="po-title">Procurement & Purchase Orders</h1>
          <p className="po-subtitle">Record and audit supplier replenishment operations</p>
        </div>
        {!isCreating && (
          <button 
            className="po-btn po-btn--primary" 
            onClick={() => setIsCreating(true)}
            style={{ minHeight: '44px' }}
          >
            <Plus size={18} />
            Create Purchase Order
          </button>
        )}
      </div>

      {isCreating ? (
        // ─── CREATE PURCHASE ORDER SCREEN ─────────────────────────────────────
        <div className="po-card po-form-card animate-fade-in">
          <div className="po-card-header">
            <h2>New Purchase Order</h2>
            <button className="po-close-btn" onClick={() => setIsCreating(false)}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreatePoSubmit} className="po-form">
            <div className="po-form-grid">
              <div className="po-form-group">
                <label className="po-label">Supplier *</label>
                <select 
                  className="po-select"
                  value={newSupplierId} 
                  onChange={(e) => setNewSupplierId(e.target.value)}
                  required
                  style={{ minHeight: '44px' }}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(sup => (
                    <option key={sup.user_id} value={sup.user_id}>{sup.username} ({sup.email})</option>
                  ))}
                </select>
              </div>

              <div className="po-form-group">
                <label className="po-label">Internal notes</label>
                <input 
                  type="text" 
                  className="po-input"
                  placeholder="e.g. Q3 general restock"
                  value={newNotes} 
                  onChange={(e) => setNewNotes(e.target.value)}
                  style={{ minHeight: '44px' }}
                />
              </div>
            </div>

            <div className="po-items-section">
              <h3>Line Items</h3>
              
              <div className="po-items-list">
                {newItems.map((item, index) => (
                  <div key={index} className="po-item-row">
                    <div className="po-form-group po-col-variant">
                      <label className="po-label po-label--mobile-only">Product Variant</label>
                      <select
                        className="po-select"
                        value={item.variant_id}
                        onChange={(e) => handleItemChange(index, 'variant_id', e.target.value)}
                        required
                        style={{ minHeight: '44px' }}
                      >
                        <option value="">Select Product Variant</option>
                        {inventoryVariants.map(v => (
                          <option key={v.variant_id} value={v.variant_id}>
                            {v.product_name} - {v.color || 'Default'} / {v.size || 'Free'} (SKU: {v.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="po-form-group po-col-qty">
                      <label className="po-label po-label--mobile-only">Quantity</label>
                      <input
                        type="number"
                        className="po-input"
                        placeholder="Qty"
                        value={item.ordered_quantity}
                        onChange={(e) => handleItemChange(index, 'ordered_quantity', e.target.value)}
                        required
                        min="1"
                        style={{ minHeight: '44px' }}
                      />
                    </div>

                    <div className="po-form-group po-col-cost">
                      <label className="po-label po-label--mobile-only">Unit Cost</label>
                      <div className="po-input-prefix-wrapper">
                        <span className="po-input-prefix">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          className="po-input"
                          placeholder="Cost"
                          value={item.unit_cost}
                          onChange={(e) => handleItemChange(index, 'unit_cost', e.target.value)}
                          required
                          min="0"
                          style={{ minHeight: '44px' }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="po-remove-btn"
                      onClick={() => handleRemoveItemRow(index)}
                      disabled={newItems.length === 1}
                      style={{ minHeight: '44px', minWidth: '44px' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="po-btn po-btn--secondary"
                onClick={handleAddItemRow}
                style={{ minHeight: '44px' }}
              >
                <Plus size={16} /> Add Item Line
              </button>
            </div>

            <div className="po-form-actions">
              <button 
                type="button" 
                className="po-btn po-btn--text" 
                onClick={() => setIsCreating(false)}
                style={{ minHeight: '44px' }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="po-btn po-btn--primary"
                disabled={submitting}
                style={{ minHeight: '44px' }}
              >
                {submitting ? <Spinner size="sm" /> : 'Save PO Draft'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        // ─── DASHBOARD REGISTRY GRID ──────────────────────────────────────────
        <div className="po-grid">
          {/* Left Column: Purchase Orders List */}
          <div className="po-grid-left po-card">
            <div className="po-card-header">
              <h2>All Purchase Orders</h2>
            </div>
            
            {purchaseOrders.length === 0 ? (
              <div className="po-empty-state">
                <FileText size={48} className="po-empty-icon" />
                <p>No purchase orders registered in system.</p>
              </div>
            ) : (
              <div className="po-list">
                {purchaseOrders.map(po => (
                  <div 
                    key={po.po_id} 
                    className={`po-list-item ${selectedPoId === po.po_id ? 'po-list-item--active' : ''}`}
                    onClick={() => setSelectedPoId(po.po_id)}
                  >
                    <div className="po-list-item-main">
                      <span className="po-list-item-title">PO #{po.po_id}</span>
                      <span className="po-list-item-supplier">{po.supplier_name}</span>
                    </div>
                    <div className="po-list-item-meta">
                      {renderStatusBadge(po.status)}
                      <span className="po-list-item-date">{new Date(po.created_at).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: PO Detail View */}
          <div className="po-grid-right po-card">
            {selectedPo ? (
              <div className="po-detail-view">
                {/* Detail Header */}
                <div className="po-detail-header">
                  <div>
                    <h2>Purchase Order #{selectedPo.po_id}</h2>
                    <p className="po-detail-date">Created on {new Date(selectedPo.created_at).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    {renderStatusBadge(selectedPo.status)}
                  </div>
                </div>

                {/* Info blocks */}
                <div className="po-info-blocks">
                  <div className="po-info-block">
                    <User size={16} className="po-info-icon" />
                    <div>
                      <span className="po-info-label">SUPPLIER</span>
                      <span className="po-info-val">{selectedPo.supplier_name}</span>
                      <span className="po-info-subval">{selectedPo.supplier_email}</span>
                    </div>
                  </div>

                  <div className="po-info-block">
                    <Layers size={16} className="po-info-icon" />
                    <div>
                      <span className="po-info-label">CREATOR</span>
                      <span className="po-info-val">{selectedPo.creator_name || 'Admin'}</span>
                    </div>
                  </div>

                  <div className="po-info-block">
                    <Calendar size={16} className="po-info-icon" />
                    <div>
                      <span className="po-info-label">LAST UPDATED</span>
                      <span className="po-info-val">{new Date(selectedPo.updated_at).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {selectedPo.notes && (
                  <div className="po-notes-callout">
                    <strong>Notes:</strong> {selectedPo.notes}
                  </div>
                )}

                {/* State Machine Actions */}
                <div className="po-actions-bar">
                  {selectedPo.status === 'DRAFT' && (
                    <button 
                      className="po-btn po-btn--primary"
                      onClick={() => handleTransitionStatus('SENT')}
                      disabled={submitting}
                      style={{ minHeight: '44px' }}
                    >
                      <Send size={16} /> Send to Supplier
                    </button>
                  )}

                  {['DRAFT', 'SENT', 'ACKNOWLEDGED'].includes(selectedPo.status) && (
                    <button 
                      className="po-btn po-btn--danger"
                      onClick={() => handleTransitionStatus('CANCELLED')}
                      disabled={submitting}
                      style={{ minHeight: '44px' }}
                    >
                      <X size={16} /> Cancel PO
                    </button>
                  )}

                  {['ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(selectedPo.status) && !isReceiving && (
                    <button 
                      className="po-btn po-btn--primary"
                      onClick={() => setIsReceiving(true)}
                      style={{ minHeight: '44px' }}
                    >
                      <ArrowRight size={16} /> Receive Inventory
                    </button>
                  )}
                </div>

                {/* Receive quantities form */}
                {isReceiving && (
                  <form onSubmit={handleReceiveStock} className="po-receive-card animate-fade-in">
                    <div className="po-receive-header">
                      <h3>Receive Inventory Quantities</h3>
                      <button 
                        type="button" 
                        className="po-close-btn"
                        onClick={() => setIsReceiving(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="po-receive-grid">
                      {selectedPo.items.map(item => {
                        const remaining = item.ordered_quantity - item.received_quantity;
                        if (remaining <= 0) return null; // Fully received line

                        return (
                          <div key={item.variant_id} className="po-receive-row">
                            <div className="po-receive-variant-info">
                              <strong>{item.product_name}</strong>
                              <span>SKU: {item.sku} ({item.color} / {item.size})</span>
                              <span>Ordered: {item.ordered_quantity} | Received: {item.received_quantity} | Pending: {remaining}</span>
                            </div>
                            <div className="po-form-group">
                              <input 
                                type="number" 
                                className="po-input"
                                placeholder={`Max: ${remaining}`}
                                max={remaining}
                                min="0"
                                value={receiveQuantities[item.variant_id] || ''}
                                onChange={(e) => setReceiveQuantities(prev => ({
                                  ...prev,
                                  [item.variant_id]: e.target.value === '' ? '' : parseInt(e.target.value, 10)
                                }))}
                                style={{ minHeight: '44px', width: '120px' }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      <div className="po-form-group" style={{ marginTop: '12px' }}>
                        <label className="po-label">Receipt note / comment</label>
                        <input 
                          type="text"
                          className="po-input"
                          placeholder="e.g. Damaged 2 units, received 38"
                          value={receiveNotes}
                          onChange={(e) => setReceiveNotes(e.target.value)}
                          style={{ minHeight: '44px' }}
                        />
                      </div>

                      <div className="po-receive-actions">
                        <button 
                          type="button" 
                          className="po-btn po-btn--text"
                          onClick={() => setIsReceiving(false)}
                          style={{ minHeight: '44px' }}
                        >
                          Close
                        </button>
                        <button 
                          type="submit" 
                          className="po-btn po-btn--primary"
                          disabled={submitting}
                          style={{ minHeight: '44px' }}
                        >
                          {submitting ? <Spinner size="sm" /> : 'Confirm Receipt'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Line Items Detail table */}
                <div className="po-detail-items">
                  <h3>Order Line Items</h3>
                  <div className="po-table-wrapper">
                    <table className="po-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>SKU</th>
                          <th>Unit Cost</th>
                          <th>Ordered</th>
                          <th>Received</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPo.items.map(item => (
                          <tr key={item.po_item_id}>
                            <td>
                              <div className="po-table-item-desc">
                                <strong>{item.product_name}</strong>
                                <span>{item.color} / {item.size}</span>
                              </div>
                            </td>
                            <td>{item.sku}</td>
                            <td>₹{item.unit_cost ? item.unit_cost.toFixed(2) : '0.00'}</td>
                            <td>{item.ordered_quantity}</td>
                            <td>{item.received_quantity}</td>
                            <td>
                              {item.received_quantity === 0 ? (
                                <span className="po-line-status po-line-status--pending">Pending</span>
                              ) : item.received_quantity === item.ordered_quantity ? (
                                <span className="po-line-status po-line-status--complete">Fully Received</span>
                              ) : (
                                <span className="po-line-status po-line-status--partial">Partial ({item.received_quantity}/{item.ordered_quantity})</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="po-detail-placeholder">
                <FileText size={64} className="po-placeholder-icon" />
                <h3>Select a Purchase Order</h3>
                <p>Select an item from the left panel to review procurement line items, track completion status, or perform receipt logging.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
