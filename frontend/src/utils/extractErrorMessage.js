/**
 * Extracts a human-readable error message from an Axios error response.
 * Handles both plain-text and JSON `{ message }` / `{ error }` responses from the backend.
 *
 * @param {Error}  err           The caught error (usually from Axios)
 * @param {string} fallback      Default message if extraction fails
 * @returns {string}
 */
export function extractErrorMessage(err, fallback = 'Something went wrong.') {
  const data = err?.response?.data;
  if (typeof data === 'string' && data.length > 0) return data;
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  return fallback;
}
