const adjustInventory = async (database, { variant_id, actor_user_id, movement_type, quantity, notes, skipTransaction }) => {
  // Validate quantity
  if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('Quantity must be a positive integer');
  }

  const ALLOWED_TYPES = [
    'SUPPLIER_RESTOCK',
    'DAMAGED',
    'MANUAL_CORRECTION',
    'INTERNAL_USAGE',
    'ORDER_SALE',
    'ORDER_CANCELLATION_RESTOCK',
    'RETURN_RESTOCK'
  ];

  if (!ALLOWED_TYPES.includes(movement_type)) {
    throw new Error(`Invalid movement type: ${movement_type}`);
  }

  if (['MANUAL_CORRECTION', 'DAMAGED'].includes(movement_type)) {
    if (!notes || notes.trim().length < 10) {
      throw new Error('Notes must be at least 10 characters long to justify manual corrections or damaged stock.');
    }
  }

  // Transaction start
  if (!skipTransaction) {
    await database.run('BEGIN TRANSACTION');
  }

  try {
    // Get current inventory
    const inv = await database.get('SELECT available_stock FROM inventory WHERE variant_id = ?', [variant_id]);
    if (!inv) {
      throw new Error(`Inventory record not found for variant ID ${variant_id}`);
    }

    const previous_quantity = inv.available_stock;
    
    // Determine sign of quantity change
    const isPositive = [
      'SUPPLIER_RESTOCK',
      'ORDER_CANCELLATION_RESTOCK',
      'RETURN_RESTOCK'
    ].includes(movement_type);

    const change = isPositive ? quantity : -quantity;
    const new_quantity = previous_quantity + change;

    if (new_quantity < 0) {
      throw new Error('Stock cannot become negative');
    }

    // Update inventory
    await database.run(
      'UPDATE inventory SET available_stock = ?, updated_at = (datetime(\'now\')) WHERE variant_id = ?',
      [new_quantity, variant_id]
    );

    // Insert inventory movement
    const result = await database.run(`
      INSERT INTO inventory_movements (variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, (datetime('now')))
    `, [variant_id, actor_user_id, movement_type, change, previous_quantity, new_quantity, notes || null]);

    if (!skipTransaction) {
      await database.run('COMMIT');
    }

    return {
      movement_id: result.lastID,
      variant_id,
      previous_quantity,
      new_quantity,
      quantity_change: change
    };
  } catch (err) {
    if (!skipTransaction) {
      await database.run('ROLLBACK');
    }
    throw err;
  }
};

const createInventoryMovement = async (database, movementData) => {
  const { variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, notes } = movementData;
  const result = await database.run(`
    INSERT INTO inventory_movements (variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, (datetime('now')))
  `, [variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, notes || null]);
  return result.lastID;
};

const getInventoryHistory = async (database, variantId) => {
  return await database.all(`
    SELECT im.*, u.username AS actor_username, pv.sku, p.product_name
    FROM inventory_movements im
    JOIN users u ON im.actor_user_id = u.user_id
    JOIN product_variants pv ON im.variant_id = pv.variant_id
    JOIN products p ON pv.product_id = p.product_id
    WHERE im.variant_id = ?
    ORDER BY im.created_at DESC, im.movement_id DESC
  `, [variantId]);
};

module.exports = {
  adjustInventory,
  createInventoryMovement,
  getInventoryHistory
};
