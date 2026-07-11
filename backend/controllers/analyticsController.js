const createAnalyticsController = (database) => {
  return {
    logEvent: async (req, res) => {
      try {
        const { event_name, session_id, product_id, category_id, metadata } = req.body;
        const user_id = req.userId || null;

        // Valid business events only
        const ALLOWED_EVENTS = [
          'product_view',
          'search_used',
          'search_suggestion_click',
          'filter_applied',
          'filter_cleared',
          'sort_changed',
          'recommendation_click',
          'wishlist_add',
          'add_to_cart',
          'purchase_complete',
          'no_results_viewed'
        ];

        // 1. Unknown events are ignored safely (return 200 to ignore silently)
        if (!ALLOWED_EVENTS.includes(event_name)) {
          return res.status(200).json({ message: 'Event ignored' });
        }

        // 2. Validate payload session ID presence
        if (!session_id) {
          return res.status(400).json({ message: 'Missing session_id' });
        }

        // 3. Write asynchronously - trigger write in background, do not await!
        // Backend generates timestamps only (server timezone is authoritative)
        database.run(`
          INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, metadata)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          event_name,
          user_id || null,
          session_id,
          product_id || null,
          category_id || null,
          metadata ? JSON.stringify(metadata) : null
        ]).catch((err) => {
          console.error('[analyticsController] DB log error:', err.message);
        });

        // 4. Return immediately (202 Accepted)
        res.status(202).json({ message: 'Event accepted' });
      } catch (err) {
        console.error('[analyticsController] logEvent exception:', err.message);
        // Telemetry errors must never impact UI
        res.status(500).json({ message: 'Internal error' });
      }
    }
  };
};

module.exports = { createAnalyticsController };
