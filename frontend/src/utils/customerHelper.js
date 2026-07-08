/**
 * Determines the customer type/segment and corresponding CSS badge class
 * based on unified business logic.
 *
 * @param {number} orderCount - Total number of orders placed by the customer
 * @param {number} totalSpend - Total monetary spending by the customer
 * @returns {{label: string, badgeClass: string}}
 */
export function getCustomerType(orderCount, totalSpend) {
  const spend = Number(totalSpend || 0);
  const count = Number(orderCount || 0);

  if (spend > 20000) {
    return { label: 'VIP', badgeClass: 'ap-badge--green' };
  }
  if (count > 3) {
    return { label: 'Returning', badgeClass: 'ap-badge--blue' };
  }
  return { label: 'New', badgeClass: 'ap-badge--yellow' };
}
