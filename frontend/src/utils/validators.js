/**
 * Validate an email address.
 * @param {string} value
 * @returns {string|null} Error message or null if valid.
 */
export function validateEmail(value) {
  if (!value || !value.trim()) return 'Email is required.';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value.trim())) return 'Please enter a valid email address.';
  return null;
}

/**
 * Validate a password (minimum 6 characters).
 * @param {string} value
 * @returns {string|null}
 */
export function validatePassword(value) {
  if (!value || !value.trim()) return 'Password is required.';
  if (value.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

/**
 * Validate that a field is not empty.
 * @param {string} value
 * @param {string} label  Field label for error messages.
 * @returns {string|null}
 */
export function validateRequired(value, label = 'This field') {
  if (value == null || String(value).trim() === '') return `${label} is required.`;
  return null;
}

/**
 * Validate that a value is a positive number.
 * @param {string|number} value
 * @param {string} label
 * @returns {string|null}
 */
export function validatePositiveNumber(value, label = 'Value') {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return `${label} must be a valid positive number.`;
  return null;
}

/**
 * Validate that selling price is not below cost price.
 * @param {string|number} selling
 * @param {string|number} cost
 * @returns {string|null}
 */
export function validateSellingVsCost(selling, cost) {
  const s = parseFloat(selling);
  const c = parseFloat(cost);
  if (isNaN(s) || isNaN(c)) return null; // Other validators catch NaN
  if (s < c) return 'Selling price must be greater than or equal to cost price.';
  return null;
}
