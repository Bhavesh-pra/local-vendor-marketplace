import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  RefreshCw, 
  Search, 
  Filter, 
  ArrowUpDown, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Gauge, 
  Clock 
} from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

export default function InventoryForecast() {
  useDocumentTitle('Inventory Forecasting — ShopCart Admin');
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedBucket, setSelectedBucket] = useState('ALL');
  
  // Sorting state
  const [sortField, setSortField] = useState('days_of_inventory');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'

  const fetchForecast = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminService.getInventoryForecast();
      setData(res);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch inventory forecast');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter and sort
  const filteredData = data.filter(item => {
    const matchesSearch = item.product_name.toLowerCase().includes(search.toLowerCase()) || 
                          item.sku.toLowerCase().includes(search.toLowerCase());
    const matchesBucket = selectedBucket === 'ALL' || item.risk_bucket === selectedBucket;
    return matchesSearch && matchesBucket;
  });

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

  // Summary counts
  const totalVariants = data.length;
  const criticalCount = data.filter(d => d.risk_bucket === 'CRITICAL').length;
  const lowCount = data.filter(d => d.risk_bucket === 'LOW').length;
  const overstockedCount = data.filter(d => d.risk_bucket === 'OVERSTOCKED').length;

  const getBucketBadgeClass = (bucket) => {
    const maps = {
      CRITICAL: 'if-badge--critical',
      LOW: 'if-badge--low',
      HEALTHY: 'if-badge--healthy',
      OVERSTOCKED: 'if-badge--overstocked',
      NO_SALES_HISTORY: 'if-badge--nosales'
    };
    return maps[bucket] || 'if-badge--gray';
  };

  const getBucketLabel = (bucket) => {
    return bucket.replace(/_/g, ' ');
  };

  if (loading) {
    return (
      <div className="if-loading-container">
        <Spinner size="lg" />
        <p>Loading inventory forecasting details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="if-error-container">
        <h2>Failed to Load Inventory Forecast</h2>
        <p>{error}</p>
        <button className="if-btn if-btn--primary" onClick={fetchForecast}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="if-container">
      {/* Header */}
      <header className="if-header">
        <div>
          <h1 className="if-title">Inventory Forecasting & Run Rate</h1>
          <p className="sp-subtitle">Observational run rate, days of inventory, and stock health risk buckets</p>
        </div>
        <button 
          className="if-btn if-btn--ghost min-touch-target" 
          onClick={fetchForecast}
          title="Refresh Data"
        >
          <RefreshCw size={15} />
          <span>Refresh</span>
        </button>
      </header>

      {/* Summary Cards */}
      <div className="if-summary-grid">
        <div className="if-card">
          <div className="if-card__header">
            <span className="if-card__title">Critical Risk</span>
            <ShieldAlert className="if-card__icon text-critical" size={20} />
          </div>
          <div className="if-card__value">{criticalCount}</div>
          <div className="if-card__subtext">&lt; 7 Days of stock remaining</div>
        </div>

        <div className="if-card">
          <div className="if-card__header">
            <span className="if-card__title">Low Stock Risk</span>
            <AlertTriangle className="if-card__icon text-low" size={20} />
          </div>
          <div className="if-card__value">{lowCount}</div>
          <div className="if-card__subtext">&lt; 21 Days of stock remaining</div>
        </div>

        <div className="if-card">
          <div className="if-card__header">
            <span className="if-card__title">Overstocked</span>
            <Gauge className="if-card__icon text-overstocked" size={20} />
          </div>
          <div className="if-card__value">{overstockedCount}</div>
          <div className="if-card__subtext">&gt; 90 Days of stock remaining</div>
        </div>

        <div className="if-card">
          <div className="if-card__header">
            <span className="if-card__title">Total Items</span>
            <CheckCircle2 className="if-card__icon text-green" size={20} />
          </div>
          <div className="if-card__value">{totalVariants}</div>
          <div className="if-card__subtext">Monitored product SKUs</div>
        </div>
      </div>

      {/* Filters */}
      <div className="if-filters-card">
        <div className="if-filters-flex">
          <div className="if-search-wrapper">
            <Search size={18} className="if-search-icon" />
            <input 
              type="text" 
              placeholder="Search SKU or product name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="if-search-input min-touch-target"
              id="forecast-search-input"
            />
          </div>

          <div className="if-select-wrapper">
            <Filter size={15} className="if-select-icon" />
            <select
              value={selectedBucket}
              onChange={(e) => setSelectedBucket(e.target.value)}
              className="if-select-input min-touch-target"
              aria-label="Filter by Risk Bucket"
              id="risk-bucket-filter"
            >
              <option value="ALL">All Risk Buckets</option>
              <option value="CRITICAL">Critical (&lt; 7 Days)</option>
              <option value="LOW">Low (&lt; 21 Days)</option>
              <option value="HEALTHY">Healthy (21-90 Days)</option>
              <option value="OVERSTOCKED">Overstocked (&gt; 90 Days)</option>
              <option value="NO_SALES_HISTORY">No Sales History</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop Table view */}
      <div className="if-table-wrapper">
        <table className="if-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('sku')} className="sortable">
                SKU <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('product_name')} className="sortable">
                Product <ArrowUpDown size={13} />
              </th>
              <th className="text-center">Details</th>
              <th onClick={() => handleSort('current_stock')} className="sortable text-center">
                Current Stock <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('sales_last_7_days')} className="sortable text-center">
                Sales 7d <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('sales_last_30_days')} className="sortable text-center">
                Sales 30d <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('sales_last_90_days')} className="sortable text-center">
                Sales 90d <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('average_daily_sales_30d')} className="sortable text-right">
                Daily Avg (30d) <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('days_of_inventory')} className="sortable text-right">
                Days of Inv <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('risk_bucket')} className="sortable text-center">
                Risk Status <ArrowUpDown size={13} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan="10" className="text-center py-8">
                  No items found matching the filter criteria.
                </td>
              </tr>
            ) : (
              sortedData.map((item) => (
                <tr key={item.variant_id}>
                  <td className="font-mono">{item.sku}</td>
                  <td className="font-medium">{item.product_name}</td>
                  <td className="text-center text-muted">
                    {item.size || item.color ? `${item.size || ''} ${item.color || ''}` : '—'}
                  </td>
                  <td className="text-center">{item.current_stock}</td>
                  <td className="text-center">{item.sales_last_7_days}</td>
                  <td className="text-center">{item.sales_last_30_days}</td>
                  <td className="text-center">{item.sales_last_90_days}</td>
                  <td className="text-right">{item.average_daily_sales_30d.toFixed(2)}</td>
                  <td className="text-right font-medium">
                    {item.days_of_inventory !== null ? `${item.days_of_inventory} days` : '—'}
                  </td>
                  <td className="text-center">
                    <span className={`if-badge ${getBucketBadgeClass(item.risk_bucket)}`}>
                      {getBucketLabel(item.risk_bucket)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card list view */}
      <div className="if-mobile-list">
        {sortedData.length === 0 ? (
          <div className="if-mobile-empty">
            No items found matching the filter criteria.
          </div>
        ) : (
          sortedData.map((item) => (
            <div key={item.variant_id} className="if-mobile-card">
              <div className="if-mobile-card__header">
                <div>
                  <span className="if-mobile-card__sku font-mono">{item.sku}</span>
                  <div className="if-mobile-card__name font-medium">{item.product_name}</div>
                </div>
                <span className={`if-badge ${getBucketBadgeClass(item.risk_bucket)}`}>
                  {getBucketLabel(item.risk_bucket)}
                </span>
              </div>
              
              <div className="if-mobile-card__body">
                <div className="if-mobile-card__row">
                  <span>Variant Details</span>
                  <span>{item.size || item.color ? `${item.size || ''} ${item.color || ''}` : '—'}</span>
                </div>
                <div className="if-mobile-card__row">
                  <span>Current Stock</span>
                  <span className="font-semibold">{item.current_stock} units</span>
                </div>
                <div className="if-mobile-card__row">
                  <span>Sales (7d / 30d / 90d)</span>
                  <span>{item.sales_last_7_days} / {item.sales_last_30_days} / {item.sales_last_90_days}</span>
                </div>
                <div className="if-mobile-card__row">
                  <span>Daily Avg Sales (30d)</span>
                  <span>{item.average_daily_sales_30d.toFixed(2)} / day</span>
                </div>
                <div className="if-mobile-card__row">
                  <span>Days of Inventory</span>
                  <span className="font-semibold">
                    {item.days_of_inventory !== null ? `${item.days_of_inventory} days` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
