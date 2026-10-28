import { useState, useEffect } from 'react';
import { 
  FileText, 
  Check, 
  Eye, 
  Calendar,
  Layers,
  User,
  AlertCircle
} from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import '../../Admin/PurchaseOrders/index.css'; // Share CSS styles

export default function SupplierPurchaseOrders() {
  useDocumentTitle('Supplier Registry — ShopCart Console');
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Data lists
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  // Selected state
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [selectedPo, setSelectedPo] = useState(null);

  // Fetch POs
  const fetchSupplierPos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await adminService.getSupplierPurchaseOrders();
      setPurchaseOrders(data.purchaseOrders);

      if (data.purchaseOrders.length > 0 && !selectedPoId) {
        setSelectedPoId(data.purchaseOrders[0].po_id);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to fetch assigned purchase orders.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplierPos();
  }, []);

  // Fetch details
  useEffect(() => {
    if (selectedPoId) {
      adminService.getSupplierPurchaseOrderDetails(selectedPoId)
        .then(data => {
          setSelectedPo(data);
        })
        .catch(err => {
          showToast('error', extractErrorMessage(err, 'Failed to load PO details.'));
        });
    } else {
      setSelectedPo(null);
    }
  }, [selectedPoId]);

  // Acknowledge Purchase Order
  const handleAcknowledgePo = async () => {
    if (!selectedPoId) return;

    try {
      setSubmitting(true);
      const res = await adminService.acknowledgePurchaseOrder(selectedPoId);
      showToast('success', res.message || 'PO acknowledged successfully');
      fetchSupplierPos();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Acknowledge request failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Render status badge helper
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
        <p>Loading assigned procurements...</p>
      </div>
    );
  }

  return (
    <div className="po-container">
      {/* Page Header */}
      <div className="po-header">
        <div>
          <h1 className="po-title">Procurement Purchase Orders</h1>
          <p className="po-subtitle">Review assigned catalog requests and acknowledge replenishment shipments</p>
        </div>
      </div>

      <div className="po-grid">
        {/* Left Column: PO List */}
        <div className="po-grid-left po-card">
          <div className="po-card-header">
            <h2>Assigned Purchase Orders</h2>
          </div>
          
          {purchaseOrders.length === 0 ? (
            <div className="po-empty-state">
              <FileText size={48} className="po-empty-icon" />
              <p>No purchase orders assigned to you.</p>
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
                    <span className="po-list-item-supplier">Items Ordered: {po.total_ordered_items}</span>
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

        {/* Right Column: PO Detail view */}
        <div className="po-grid-right po-card">
          {selectedPo ? (
            <div className="po-detail-view">
              {/* Detail Header */}
              <div className="po-detail-header">
                <div>
                  <h2>Purchase Order #{selectedPo.po_id}</h2>
                  <p className="po-detail-date">Issued on {new Date(selectedPo.created_at).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  {renderStatusBadge(selectedPo.status)}
                </div>
              </div>

              {/* Info block */}
              <div className="po-info-blocks">
                <div className="po-info-block">
                  <User size={16} className="po-info-icon" />
                  <div>
                    <span className="po-info-label">ISSUED BY</span>
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
                  <strong>Special Instructions:</strong> {selectedPo.notes}
                </div>
              )}

              {/* Actions */}
              {selectedPo.status === 'SENT' && (
                <div className="po-actions-bar">
                  <button 
                    className="po-btn po-btn--primary"
                    onClick={handleAcknowledgePo}
                    disabled={submitting}
                    style={{ minHeight: '44px' }}
                  >
                    <Check size={16} /> Acknowledge Purchase Order
                  </button>
                </div>
              )}

              {/* Line Items Table */}
              <div className="po-detail-items">
                <h3>Procurement Line Items</h3>
                <div className="po-table-wrapper">
                  <table className="po-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>SKU</th>
                        <th>Ordered Quantity</th>
                        <th>Received Quantity</th>
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
                          <td>{item.ordered_quantity}</td>
                          <td>{item.received_quantity}</td>
                          <td>
                            {item.received_quantity === 0 ? (
                              <span className="po-line-status po-line-status--pending">Pending Receipt</span>
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
              <p>Select a PO card from the left panel to review procurement line items and verify shipping status.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
