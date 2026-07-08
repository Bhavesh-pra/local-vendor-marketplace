import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { OrderCard } from './components/OrderCard/index.jsx';
import { Spinner } from '../../components/ui/Spinner/index.jsx';
import { ErrorState } from '../../components/ui/ErrorState/index.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { getMyOrders } from '../../services/orderService.js';
import { extractErrorMessage } from '../../utils/extractErrorMessage.js';
import OrdersFilterBar from './components/OrdersFilterBar.jsx';
import OrdersEmpty from './components/OrdersEmpty.jsx';
import './index.css';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'processing', 'shipped'];

export default function Orders() {
  useDocumentTitle('My Orders');

  // Page level states
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  // Fetch list of orders on mount
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load your orders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Compute counts for all filter chips based on full orders list
  const filterCounts = useMemo(() => {
    const counts = { all: 0, active: 0, delivered: 0, cancelled: 0 };
    orders.forEach((order) => {
      const status = order.status?.toLowerCase();
      counts.all += 1;
      if (ACTIVE_STATUSES.includes(status)) {
        counts.active += 1;
      } else if (status === 'delivered') {
        counts.delivered += 1;
      } else if (status === 'cancelled') {
        counts.cancelled += 1;
      }
    });
    return counts;
  }, [orders]);

  // Perform instant client-side filtering
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const status = order.status?.toLowerCase();
      if (activeFilter === 'active') {
        return ACTIVE_STATUSES.includes(status);
      }
      if (activeFilter === 'delivered') {
        return status === 'delivered';
      }
      if (activeFilter === 'cancelled') {
        return status === 'cancelled';
      }
      return true; // 'all'
    });
  }, [orders, activeFilter]);

  // Generate header text and counts
  const getHeaderInfo = () => {
    let label = 'All Orders';
    let count = filterCounts.all;
    if (activeFilter === 'active') {
      label = 'Active Orders';
      count = filterCounts.active;
    } else if (activeFilter === 'delivered') {
      label = 'Delivered Orders';
      count = filterCounts.delivered;
    } else if (activeFilter === 'cancelled') {
      label = 'Cancelled Orders';
      count = filterCounts.cancelled;
    }
    const suffix = count === 1 ? 'Order' : 'Orders';
    return { label, countString: `${count} ${suffix}` };
  };

  const { label: headerLabel, countString: headerCount } = getHeaderInfo();

  if (loading) {
    return (
      <PageLayout>
        <div className="orders-page__loading">
          <Spinner size="lg" />
          <p className="orders-page__loading-text">Loading your orders...</p>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="orders-page__error">
          <ErrorState message={error} onRetry={fetchOrders} />
        </div>
      </PageLayout>
    );
  }

  // Entirely empty state (zero purchases placed by user)
  if (orders.length === 0) {
    return (
      <PageLayout>
        <div className="orders-page container">
          <OrdersEmpty />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="orders-page container">
        {/* Page Title & Count */}
        <div className="orders-page__header">
          <h1 className="orders-page__title">My Orders</h1>
          <p className="orders-page__count-badge">{headerLabel} &bull; {headerCount}</p>
        </div>

        {/* Dynamic filter tab bar */}
        <OrdersFilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={filterCounts}
        />

        {/* Filtered Orders list */}
        {filteredOrders.length === 0 ? (
          <div className="orders-page__no-match">
            {activeFilter === 'cancelled' && (
              <>
                <h4 className="orders-page__no-match-title">No cancelled orders</h4>
                <p className="orders-page__no-match-desc">Cancelled orders will appear here.</p>
              </>
            )}
            {activeFilter === 'delivered' && (
              <>
                <h4 className="orders-page__no-match-title">No delivered orders yet</h4>
                <p className="orders-page__no-match-desc">Completed purchases will appear here.</p>
              </>
            )}
            {activeFilter === 'active' && (
              <>
                <h4 className="orders-page__no-match-title">No active orders yet</h4>
                <p className="orders-page__no-match-desc">Ongoing purchases will appear here.</p>
              </>
            )}
            {activeFilter === 'all' && (
              <>
                <h4 className="orders-page__no-match-title">No orders found</h4>
                <p className="orders-page__no-match-desc">Any purchases you place will appear here.</p>
              </>
            )}
          </div>
        ) : (
          <div className="orders-page__list">
            {filteredOrders.map((order) => (
              <OrderCard key={order.order_id} order={order} />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
