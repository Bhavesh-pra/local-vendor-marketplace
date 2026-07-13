/**
 * Phase 5E — Notification Controller
 */

const createNotificationController = (database) => ({
  getNotifications: async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    try {
      // 1. Fetch total count
      const totalObj = await database.get(
        `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ?`,
        [req.userId]
      );
      const total = totalObj?.count || 0;

      // 2. Fetch unread count
      const unreadObj = await database.get(
        `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0`,
        [req.userId]
      );
      const unread_count = unreadObj?.count || 0;

      // 3. Fetch notifications for current page
      const rows = await database.all(
        `SELECT notification_id, user_id, type, title, message, metadata, is_read, created_at, read_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [req.userId, limit, offset]
      );

      // Parse metadata from JSON string
      const notifications = rows.map((r) => {
        let meta = null;
        if (r.metadata) {
          try {
            meta = JSON.parse(r.metadata);
          } catch (e) {
            meta = r.metadata;
          }
        }
        return {
          ...r,
          is_read: !!r.is_read,
          metadata: meta
        };
      });

      const has_next = offset + rows.length < total;

      res.json({
        notifications,
        total,
        unread_count,
        page,
        limit,
        has_next
      });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  markAsRead: async (req, res) => {
    const { id } = req.params;
    try {
      const notif = await database.get(
        `SELECT user_id, is_read FROM notifications WHERE notification_id = ?`,
        [id]
      );

      if (!notif) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      if (notif.user_id !== req.userId) {
        return res.status(403).json({ message: 'Access denied: You do not own this notification' });
      }

      // If already read, return success directly (idempotency)
      if (notif.is_read === 1) {
        return res.json({ message: 'Notification marked as read' });
      }

      await database.run(
        `UPDATE notifications
         SET is_read = 1, read_at = datetime('now')
         WHERE notification_id = ?`,
        [id]
      );

      res.json({ message: 'Notification marked as read' });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  markAllAsRead: async (req, res) => {
    try {
      await database.run(
        `UPDATE notifications
         SET is_read = 1, read_at = datetime('now')
         WHERE user_id = ? AND is_read = 0`,
        [req.userId]
      );

      res.json({ message: 'All notifications marked as read' });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  }
});

module.exports = { createNotificationController };
