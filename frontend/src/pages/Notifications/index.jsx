/**
 * Phase 5E — Notifications Page
 */
import { useState, useEffect, useCallback } from 'react';
import { getNotifications, markAsRead, markAllAsRead } from '../../services/notificationService.js';
import { PageLayout } from '../../components/layout/PageLayout/index.jsx';
import { Bell, Check, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import './index.css';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getNotifications({ page, limit });
      setNotifications(data.notifications);
      setTotal(data.total);
      setUnreadCount(data.unread_count);
      setHasNext(data.has_next);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await markAsRead(id);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err.message);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <PageLayout>
      <div className="notifications-page container">
        <header className="notifications-page__header">
          <div className="notifications-page__title-group">
            <h1 className="notifications-page__title">Notifications</h1>
            <p className="notifications-page__subtitle">
              You have {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="notifications-page__mark-all-btn"
              type="button"
            >
              <CheckCheck size={16} aria-hidden="true" />
              <span>Mark all as read</span>
            </button>
          )}
        </header>

        {error && <div className="notifications-page__error">{error}</div>}

        {loading ? (
          <div className="notifications-page__loading">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="notifications-page__empty">
            <div className="notifications-page__empty-icon">
              <Bell size={48} aria-hidden="true" />
            </div>
            <h3>No notifications yet</h3>
            <p>You're all caught up! Important updates about your orders and reviews will appear here.</p>
          </div>
        ) : (
          <div className="notifications-page__content">
            <div className="notifications-list">
              {notifications.map((notif) => (
                <div
                  key={notif.notification_id}
                  className={`notification-item ${!notif.is_read ? 'notification-item--unread' : ''}`}
                >
                  <div className="notification-item__indicator" />
                  <div className="notification-item__main">
                    <div className="notification-item__header">
                      <h3 className="notification-item__title">{notif.title}</h3>
                      <span className="notification-item__time">
                        {new Date(notif.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="notification-item__message">{notif.message}</p>
                  </div>
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkRead(notif.notification_id)}
                      className="notification-item__read-btn"
                      aria-label="Mark as read"
                      type="button"
                    >
                      <Check size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="notifications-page__pagination">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="notifications-page__pagination-btn"
                  aria-label="Previous page"
                  type="button"
                >
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <span className="notifications-page__pagination-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => (hasNext ? p + 1 : p))}
                  disabled={!hasNext}
                  className="notifications-page__pagination-btn"
                  aria-label="Next page"
                  type="button"
                >
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
