const getReturnEligibility = async (database, orderId, variantId) => {
  // 1. Fetch order details
  const order = await database.get(
    `SELECT status, delivered_at FROM orders WHERE order_id = ?`,
    [orderId]
  );
  if (!order) {
    return { status: 'not_found' };
  }

  if (order.status !== 'delivered') {
    return {
      status: 'NOT_DELIVERED',
      message: 'Order not delivered yet'
    };
  }

  // 2. Fetch delivered_at date
  if (!order.delivered_at) {
    console.warn(`[ReturnEligibility] Order #${orderId} is delivered but delivered_at is null!`);
    return {
      status: 'DELIVERY_DATE_MISSING',
      message: 'Delivery date information missing'
    };
  }

  const deliveredAt = new Date(order.delivered_at);

  // 2.5. Check if an active return request already exists
  const existingRequest = await database.get(
    `SELECT return_id, request_type, status, admin_notes, created_at, updated_at
     FROM returns WHERE order_id = ? AND variant_id = ?`,
    [orderId, variantId]
  );
  if (existingRequest && existingRequest.status !== 'REJECTED') {
    return {
      status: 'REQUEST_EXISTS',
      message: existingRequest.request_type === 'return' ? 'Return request submitted' : 'Replacement request submitted',
      return_request: existingRequest
    };
  }

  // 3. Fetch product return policy
  const productInfo = await database.get(
    `SELECT p.product_id, rp.type AS policy_type, rp.days AS policy_days, rp.name AS policy_name
     FROM product_variants pv
     JOIN products p ON pv.product_id = p.product_id
     LEFT JOIN return_policies rp ON p.return_policy_id = rp.policy_id
     WHERE pv.variant_id = ?`,
    [variantId]
  );

  if (!productInfo) {
    return { status: 'product_not_found' };
  }

  const { policy_type, policy_days, policy_name } = productInfo;

  if (!policy_type || policy_type === 'non_returnable') {
    return {
      status: 'NON_RETURNABLE',
      message: 'This item is non-returnable',
      policy_name
    };
  }

  // 4. Check if return window is expired
  const expirationDate = new Date(deliveredAt.getTime() + policy_days * 24 * 60 * 60 * 1000);
  const isExpired = new Date() > expirationDate;

  // Formatting date standard (e.g. 15 July 2026)
  const formatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  // Formats to match locales correctly, using en-GB to output "15 July 2026"
  let expDateString = '—';
  try {
    expDateString = expirationDate.toLocaleDateString('en-GB', formatOptions);
  } catch (e) {
    expDateString = expirationDate.toDateString();
  }

  if (isExpired) {
    return {
      status: 'WINDOW_EXPIRED',
      message: `Return window expired on ${expDateString}`,
      expiration_date: expirationDate.toISOString(),
      policy_name
    };
  }

  // 5. Eligible status
  if (policy_type === 'replacement_only') {
    return {
      status: 'REPLACEMENT_ELIGIBLE',
      message: `Eligible for replacement until ${expDateString}`,
      expiration_date: expirationDate.toISOString(),
      policy_name
    };
  }

  return {
    status: 'RETURN_ELIGIBLE',
    message: `Eligible for return until ${expDateString}`,
    expiration_date: expirationDate.toISOString(),
    policy_name
  };
};

module.exports = { getReturnEligibility };
