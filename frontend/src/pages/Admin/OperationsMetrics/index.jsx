import { useState, useEffect } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Search, 
  Filter, 
  ArrowUpDown, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Award,
  Layers
} from 'lucide-react';
import { adminService } from '../../../services/adminService.js';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { extractErrorMessage } from '../../../utils/extractErrorMessage.js';
import './index.css';

export default function OperationsMetrics() {
  useDocumentTitle('Operations & Optimization — ShopCart Admin');
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedFlag, setSelectedFlag] = useState('ALL');
  
  // Sorting state
  const [sortField, setSortField] = useState('inventory_turnover');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminService.getOperationsMetrics();
      setData(res);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to fetch operations metrics');
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
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
    const matchesFlag = selectedFlag === 'ALL' || item.flags.includes(selectedFlag);
    return matchesSearch && matchesFlag;
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
  const fastMovingCount = data.filter(d => d.flags.includes('FAST_MOVING')).length;
  const slowMovingCount = data.filter(d => d.flags.includes('SLOW_MOVING')).length;
  const highReturnCount = data.filter(d => d.flags.includes('HIGH_RETURN_RATE')).length;

  const getFlagBadgeClass = (flag) => {
    const maps = {
      FAST_MOVING: 'op-badge--fast',
      SLOW_MOVING: 'op-badge--slow',
      HIGH_RETURN_RATE: 'op-badge--return'
    };
    return maps[flag] || 'op-badge--gray';
  };

  const getFlagLabel = (flag) => {
    return flag.replace(/_/g, ' ');
  };

  if (loading) {
    return (
      <div className="op-loading-container">
        <Spinner size="lg" />
        <p>Loading optimization & operations metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="op-error-container">
        <h2>Failed to Load Operations Metrics</h2>
        <p>{error}</p>
        <button className="op-btn op-btn--primary" onClick={fetchMetrics}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="op-container">
      {/* Header */}
      <header className="op-header">
        <div>
          <h1 className="op-title">Optimization & Operational Metrics</h1>
          <p className="sp-subtitle">Observational statistics on inventory velocity, product return ratios, and sell-through rates</p>
        </div>
        <button 
          className="op-btn op-btn--ghost min-touch-target" 
          onClick={fetchMetrics}
          title="Refresh Data"
        >
          <RefreshCw size={15} />
          <span>Refresh</span>
        </button>
      </header>

      {/* Summary Cards */}
      <div className="op-summary-grid">
        <div className="op-card">
          <div className="op-card__header">
            <span className="op-card__title">Fast Moving Items</span>
            <TrendingUp className="op-card__icon text-green" size={20} />
          </div>
          <div className="op-card__value">{fastMovingCount}</div>
          <div className="op-card__subtext">Turnover velocity &gt; 2.0</div>
        </div>

        <div className="op-card">
          <div className="op-card__header">
            <span className="op-card__title">Slow Moving Items</span>
            <TrendingDown className="op-card__icon text-yellow" size={20} />
          </div>
          <div className="op-card__value">{slowMovingCount}</div>
          <div className="op-card__subtext">Turnover velocity &lt; 0.25</div>
        </div>

        <div className="op-card">
          <div className="op-card__header">
            <span className="op-card__title">High Return Rate</span>
            <AlertTriangle className="op-card__icon text-critical" size={20} />
          </div>
          <div className="op-card__value">{highReturnCount}</div>
          <div className="op-card__subtext">Return percentage &gt; 20%</div>
        </div>

        <div className="op-card">
          <div className="op-card__header">
            <span className="op-card__title">Active SKU Items</span>
            <Layers className="op-card__icon text-brand" size={20} />
          </div>
          <div className="op-card__value">{totalVariants}</div>
          <div className="op-card__subtext">Monitored product lines</div>
        </div>
      </div>

      {/* Filters */}
      <div className="op-filters-card">
        <div className="op-filters-flex">
          <div className="op-search-wrapper">
            <Search size={18} className="op-search-icon" />
            <input 
              type="text" 
              placeholder="Search SKU or product name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="op-search-input min-touch-target"
              id="operations-search-input"
            />
          </div>

          <div className="op-select-wrapper">
            <Filter size={15} className="op-select-icon" />
            <select
              value={selectedFlag}
              onChange={(e) => setSelectedFlag(e.target.value)}
              className="op-select-input min-touch-target"
              aria-label="Filter by Operational Flag"
              id="operational-flag-filter"
            >
              <option value="ALL">All Operational Flags</option>
              <option value="FAST_MOVING">Fast Moving (&gt; 2.0 Turnover)</option>
              <option value="SLOW_MOVING">Slow Moving (&lt; 0.25 Turnover)</option>
              <option value="HIGH_RETURN_RATE">High Return Rate (&gt; 20%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop Table view */}
      <div className="op-table-wrapper">
        <table className="op-table">
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
              <th onClick={() => handleSort('units_sold_90d')} className="sortable text-center">
                Sold 90d <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('average_inventory_90d')} className="sortable text-center">
                Avg Inv 90d <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('inventory_turnover')} className="sortable text-right">
                Turnover Ratio <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('return_rate')} className="sortable text-right">
                Return Rate <ArrowUpDown size={13} />
              </th>
              <th onClick={() => handleSort('sell_through_rate')} className="sortable text-right">
                Sell Through <ArrowUpDown size={13} />
              </th>
              <th className="text-center">Flags</th>
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
                  <td className="text-center">{item.units_sold_90d}</td>
                  <td className="text-center">{item.average_inventory_90d.toFixed(1)}</td>
                  <td className="text-right font-medium text-info">{item.inventory_turnover.toFixed(2)}</td>
                  <td className="text-right text-critical">{(item.return_rate * 100).toFixed(1)}%</td>
                  <td className="text-right text-green">{(item.sell_through_rate * 100).toFixed(1)}%</td>
                  <td className="text-center">
                    <div className="op-badge-cell">
                      {item.flags.length === 0 ? (
                        <span className="text-muted text-xs">—</span>
                      ) : (
                        item.flags.map(flag => (
                          <span key={flag} className={`op-badge ${getFlagBadgeClass(flag)}`}>
                            {getFlagLabel(flag)}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card list view */}
      <div className="op-mobile-list">
        {sortedData.length === 0 ? (
          <div className="op-mobile-empty">
            No items found matching the filter criteria.
          </div>
        ) : (
          sortedData.map((item) => (
            <div key={item.variant_id} className="op-mobile-card">
              <div className="op-mobile-card__header">
                <div>
                  <span className="op-mobile-card__sku font-mono">{item.sku}</span>
                  <div className="op-mobile-card__name font-medium">{item.product_name}</div>
                </div>
              </div>
              
              <div className="op-mobile-card__body">
                <div className="op-mobile-card__row">
                  <span>Variant Details</span>
                  <span>{item.size || item.color ? `${item.size || ''} ${item.color || ''}` : '—'}</span>
                </div>
                <div className="op-mobile-card__row">
                  <span>Current Stock</span>
                  <span className="font-semibold">{item.current_stock} units</span>
                </div>
                <div className="op-mobile-card__row">
                  <span>Sold (90d) / Avg Inv</span>
                  <span>{item.units_sold_90d} / {item.average_inventory_90d.toFixed(1)}</span>
                </div>
                <div className="op-mobile-card__row">
                  <span>Turnover Ratio</span>
                  <span className="text-info font-semibold">{item.inventory_turnover.toFixed(2)}</span>
                </div>
                <div className="op-mobile-card__row">
                  <span>Return Rate</span>
                  <span className="text-critical font-semibold">{(item.return_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="op-mobile-card__row">
                  <span>Sell Through Rate</span>
                  <span className="text-green font-semibold">{(item.sell_through_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="op-mobile-card__flags-row">
                  <span>Operational Flags</span>
                  <div className="op-mobile-card__badges">
                    {item.flags.length === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      item.flags.map(flag => (
                        <span key={flag} className={`op-badge ${getFlagBadgeClass(flag)}`}>
                          {getFlagLabel(flag)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
