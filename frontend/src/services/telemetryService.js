import axiosInstance from '../lib/axios.js';

/**
 * Fallback UUID generator if browser doesn't support crypto.randomUUID
 */
function generateUUIDFallback() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Retrieve or generate session ID stored in sessionStorage (persists for tab lifetime)
 */
export function getSessionId() {
  let sessionId = sessionStorage.getItem('shopcart_session_id');
  if (!sessionId) {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
      try {
        sessionId = window.crypto.randomUUID();
      } catch (_) {
        sessionId = generateUUIDFallback();
      }
    } else {
      sessionId = generateUUIDFallback();
    }
    sessionStorage.setItem('shopcart_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Asynchronously posts telemetry event. Fails silently without impacting user UX.
 */
export function trackTelemetryEvent(eventName, data = {}) {
  try {
    const sessionId = getSessionId();

    // Try to get authenticated user ID if exists in storage
    let userId = null;
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        userId = user.user_id || user.id || null;
      }
    } catch (_) {}

    const payload = {
      event_name: eventName,
      session_id: sessionId,
      user_id: userId,
      product_id: data.productId || null,
      category_id: data.categoryId || null,
      metadata: data.metadata || null
    };

    // Asynchronous fire-and-forget: do not await!
    axiosInstance.post('/analytics/event', payload).catch(() => {
      // Ignore network / endpoint failures silently
    });
  } catch (_) {
    // Ignore all telemetry tracking exceptions
  }
}
