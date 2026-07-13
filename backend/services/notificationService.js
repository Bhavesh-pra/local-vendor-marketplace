/**
 * Phase 5E — Notification Service
 */

/**
 * Creates a transactional notification for a specific user.
 * This function enforces idempotency using the UNIQUE `event_key` constraint.
 *
 * @param {object} database SQLite database instance or active transaction
 * @param {object} params
 * @param {number} params.user_id Target user
 * @param {string} params.type Notification category
 * @param {string} params.title Notification title
 * @param {string} params.message body text
 * @param {object|string|null} [params.metadata] Associated data references
 * @param {string} params.event_key Deterministic identifier (e.g. 'ORDER_PLACED:52')
 */
const createNotification = async (database, { user_id, type, title, message, metadata, event_key }) => {
  if (!user_id || !type || !title || !message || !event_key) {
    throw new Error('Missing required fields for notification creation.');
  }

  const metaString = metadata
    ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata))
    : null;

  try {
    // Using INSERT OR IGNORE to satisfy Rule 5 (idempotent creation)
    await database.run(
      `INSERT OR IGNORE INTO notifications (user_id, type, title, message, metadata, event_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [user_id, type, title, message, metaString, event_key]
    );
  } catch (err) {
    console.error('[NotificationService] Error creating notification:', err.message);
    throw err;
  }
};

module.exports = { createNotification };
