/**
 * localStorage wrapper with JSON serialisation and silent error handling.
 * No component or service should access localStorage directly.
 */

/**
 * Read and deserialise a value from localStorage.
 * @param {string} key
 * @returns {*} Parsed value or null if missing/invalid.
 */
export function getItem(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Serialise and write a value to localStorage.
 * @param {string} key
 * @param {*} value
 */
export function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or quota exceeded — fail silently
  }
}

/**
 * Remove a key from localStorage.
 * @param {string} key
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Fail silently
  }
}
