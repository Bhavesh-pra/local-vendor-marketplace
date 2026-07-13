const checkReviewEligibility = async (database, userId, productId) => {
  if (!userId) {
    return {
      eligible: false,
      message: 'You must be logged in to check review eligibility.'
    };
  }

  try {
    // Find all delivered order items for this user and product
    const deliveredItems = await database.all(
      `SELECT oi.order_item_id, oi.order_id, o.order_number, o.delivered_at
       FROM orders o
       JOIN order_items oi ON o.order_id = oi.order_id
       JOIN product_variants pv ON oi.variant_id = pv.variant_id
       WHERE o.user_id = ?
         AND pv.product_id = ?
         AND o.status = 'delivered'`,
      [userId, productId]
    );

    if (!deliveredItems || deliveredItems.length === 0) {
      return {
        eligible: false,
        message: 'You must purchase this product to write a review.'
      };
    }

    // Find which of these order items have already been reviewed
    const reviewedItemIds = (await database.all(
      `SELECT order_item_id FROM reviews WHERE user_id = ? AND product_id = ? AND order_item_id IS NOT NULL`,
      [userId, productId]
    )).map(r => r.order_item_id);

    // Filter to find items that have NOT been reviewed yet
    const unreviewedItems = deliveredItems.filter(
      item => !reviewedItemIds.includes(item.order_item_id)
    );

    if (unreviewedItems.length === 0) {
      return {
        eligible: false,
        message: 'You have already reviewed all purchased items for this product.'
      };
    }

    return {
      eligible: true,
      orderItems: unreviewedItems
    };
  } catch (err) {
    console.error('[ReviewEligibility] Error checking eligibility:', err.message);
    return {
      eligible: false,
      message: 'Error verifying review eligibility: ' + err.message
    };
  }
};

module.exports = { checkReviewEligibility };
