import { useState, useEffect } from 'react';
import { 
  UserCheck, 
  RefreshCw, 
  Search, 
  ArrowUpDown, 
  TrendingUp, 
  ShoppingBag, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  Clock, 
  Calendar 
} from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

export default function SupplierPerformance() {
  useDocumentTitle('Supplier Performance — ShopCart Admin');
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  
  // Sorting state
  const [sortField, setSortField] = useState('supplier_name');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminService.getSupplierPerformance();
      setData(res);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch supplier performance');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter and sort data
  const filteredData = data.filter(item => 
    item.supplier_name.toLowerCase().includes(search.toLowerCase())
  );

  const sortedData = [...filteredData].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (aVal === null || aVal === undefined) return sortOrder === 'asc' ? 1 : -1;
    if (bVal === null || bVal === undefined) return sortOrder === 'asc' ? -1 : 1;

    if (typeof aVal === 'string') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    } else {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
  });

  // Aggregates for summary cards
  const totalSuppliers = data.length;
  const totalActivePOs = data.reduce((sum, item) => sum + item.active_purchase_orders, 0);
  const avgFulfillmentRate = data.length > 0 
    ? (data.reduce((sum, item) => sum + item.fulfillment_rate, 0) / data.length)
    : 0;
  const avgFillRate = data.length > 0
    ? (data.reduce((sum, item) => sum + item.fill_rate, 0) / data.length)
    : 0;

  if (loading) {
    return (
      <div className="sp-loading-container">
        <Spinner size="lg" />
        <p>Loading supplier performance metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sp-error-container">
        <h2>Failed to Load Performance Metrics</h2>
        <p>{error}</p>
        <button className="sp-btn sp-btn--primary" onClick={fetchPerformance}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="sp-container">
      {/* Header */}
      <header className="sp-header">
        <div>
          <h1 className="sp-title">Supplier Performance Analytics</h1>
          <p className="sp-subtitle">Observational procurement statistics and order fulfillment metrics</p>
        </div>
        <button 
          className="sp-btn sp-btn--ghost min-touch-target" 
          onClick={fetchPerformance}
          title="Refresh Data"
        >
          <RefreshCw size={15} />
          <span>Refresh</span>
        </button>
      </header>

      {/* Summary Cards */}
      <div className="sp-summary-grid">
        <div className="sp-card">
          <div className="sp-card__header">
            <span className="sp-card__title">Total Suppliers</span>
            <UserCheck className="sp-card__icon text-brand" size={20} />
          </div>
          <div className="sp-card__value">{totalSuppliers}</div>
          <div className="sp-card__subtext">Registered partners</div>
        </div>

        <div className="sp-card">
          <div className="sp-card__header">
            <span className="sp-card__title">Active Purchase Orders</span>
            <ShoppingBag className="sp-card__icon text-yellow" size={20} />
          </div>
          <div className="sp-card__value">{totalActivePOs}</div>
          <div className="sp-card__subtext">In-flight shipments</div>
        </div>

        <div className="sp-card">
          <div className="sp-card__header">
            <span className="sp-card__title">Avg Fulfillment Rate</span>
            <Percent className="sp-card__icon text-green" size={20} />
          </div>
          <div className="sp-card__value">{(avgFulfillmentRate * 100).toFixed(1)}%</div>
          <div className="sp-card__subtext">Completed POs / Total POs</div>
        </div>

        <div className="sp-card">
          <div className="sp-card__header">
            <span className="sp-card__title">Avg Fill Rate</span>
            <CheckCircle2 className="sp-card__icon text-info" size={20} />
          </div>
          <div className="sp-card__value">{(avgFillRate * 100).toFixed(1)}%</div>
          <div className="sp-card__subtext">Items Received / Ordered</div>
        </div>
      </div>

      {/* Filters */}
      <div className="sp-filters-card">
        <div className="sp-search-wrapper">
          <Search size={18} className="sp-search-icon" />
          <input 
            type="text" 
            placeholder="Search by supplier name..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sp-search-input min-touch-target"
            id="supplier-search-input"
          />
        </div>
      </div>

      {/* Main Table view for Desktop */}
      <div className="sp-table-wrapper">
        <table className="sp-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('supplier_name')} className="sortable">
                Supplier Name <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('active_purchase_orders')} className="sortable text-center">
                Active POs <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('total_purchase_orders')} className="sortable text-center">
                Total POs <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('completed_purchase_orders')} className="sortable text-center">
                Completed POs <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('cancelled_purchase_orders')} className="sortable text-center">
                Cancelled POs <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('fulfillment_rate')} className="sortable text-right">
                Fulfillment Rate <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('quantity_ordered')} className="sortable text-right">
                Qty Ordered <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('quantity_received')} className="sortable text-right">
                Qty Received <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('fill_rate')} className="sortable text-right">
                Fill Rate <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('average_ack_hours')} className="sortable text-right">
                Avg Ack (Hrs) <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('average_delivery_days')} className="sortable text-right">
                Avg Delivery (Days) <ArrowUpDown size={13} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan="11" className="text-center py-8">
                  No suppliers found matching your query.
                </td>
              </tr>
            ) : (
              sortedData.map((item) => (
                <tr key={item.supplier_id}>
                  <td className="font-medium">{item.supplier_name}</td>
                  <td className="text-center">{item.active_purchase_orders}</td>
                  <td className="text-center">{item.total_purchase_orders}</td>
                  <td className="text-center">{item.completed_purchase_orders}</td>
                  <td className="text-center">{item.cancelled_purchase_orders}</td>
                  <td className="text-right font-medium text-green">
                    {(item.fulfillment_rate * 100).toFixed(1)}%
                  </td>
                  <td className="text-right">{item.quantity_ordered}</td>
                  <td className="text-right">{item.quantity_received}</td>
                  <td className="text-right font-medium text-info">
                    {(item.fill_rate * 100).toFixed(1)}%
                  </td>
                  <td className="text-right">
                    {item.average_ack_hours !== null ? `${item.average_ack_hours.toFixed(1)}h` : '—'}
                  </td>
                  <td className="text-right">
                    {item.average_delivery_days !== null ? `${item.average_delivery_days.toFixed(1)}d` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card list view (No horizontal scrolling) */}
      <div className="sp-mobile-list">
        {sortedData.length === 0 ? (
          <div className="sp-mobile-empty">
            No suppliers found matching your query.
          </div>
        ) : (
          sortedData.map((item) => (
            <div key={item.supplier_id} className="sp-mobile-card">
              <div className="sp-mobile-card__header">
                <span className="sp-mobile-card__name">{item.supplier_name}</span>
              </div>
              
              <div className="sp-mobile-card__body">
                <div className="sp-mobile-card__row">
                  <span>Active / Total POs</span>
                  <span className="font-semibold">{item.active_purchase_orders} / {item.total_purchase_orders}</span>
                </div>
                <div className="sp-mobile-card__row">
                  <span>Completed / Cancelled POs</span>
                  <span>{item.completed_purchase_orders} / {item.cancelled_purchase_orders}</span>
                </div>
                <div className="sp-mobile-card__row">
                  <span>Fulfillment Rate</span>
                  <span className="text-green font-semibold">{(item.fulfillment_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="sp-mobile-card__row">
                  <span>Qty Ordered / Received</span>
                  <span>{item.quantity_ordered} / {item.quantity_received}</span>
                </div>
                <div className="sp-mobile-card__row">
                  <span>Fill Rate</span>
                  <span className="text-info font-semibold">{(item.fill_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="sp-mobile-card__row">
                  <span>Avg Ack (Hours)</span>
                  <span>{item.average_ack_hours !== null ? `${item.average_ack_hours.toFixed(1)}h` : '—'}</span>
                </div>
                <div className="sp-mobile-card__row">
                  <span>Avg Delivery (Days)</span>
                  <span>{item.average_delivery_days !== null ? `${item.average_delivery_days.toFixed(1)}d` : '—'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
