const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { adjustInventory, getInventoryHistory, createInventoryMovement } = require('../services/inventoryService');

async function runTests() {
  console.log('Starting Phase 6B Inventory Operations Tests...');

  const mainDbPath = path.join(__dirname, '../ecommerce.sqlite');
  const testDbPath = path.join(__dirname, 'test_inventory.sqlite');

  // Copy database file to avoid cluttering main db
  fs.copyFileSync(mainDbPath, testDbPath);
  console.log('Copied database to test file.');

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database,
  });

  try {
    // ─── 1. SETUP CLEAN STATE ───
    await db.run('DELETE FROM inventory_movements');
    await db.run('DELETE FROM inventory');
    await db.run('DELETE FROM product_variants');
    await db.run('DELETE FROM products');
    await db.run('DELETE FROM users');

    // Seed test users, products, variants, and inventory
    await db.run("INSERT INTO users (user_id, username, email, password_hash, role) VALUES (1, 'admin', 'admin@test.com', 'hash', 'admin')");
    await db.run("INSERT INTO users (user_id, username, email, password_hash, role) VALUES (2, 'supplier', 'supplier@test.com', 'hash', 'supplier')");
    await db.run("INSERT INTO products (product_id, supplier_id, category_id, product_name, description, cost_price, selling_price, mrp, brand, slug) VALUES (1, 1, 1, 'Prod 1', 'Desc 1', 50, 100, 100, 'Brand A', 'prod-1')");
    await db.run("INSERT INTO product_variants (variant_id, product_id, sku, size, color, is_default) VALUES (1, 1, 'SKU-1', 'M', 'Black', 1)");
    await db.run("INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price) VALUES (1, 1, 50, 0, 5, 50)");

    console.log('Setup and Seeding completed successfully.');

    // ─── Test 1: Positive movements (SUPPLIER_RESTOCK) ───
    console.log('\n--- TEST 1: POSITIVE MOVEMENTS (SUPPLIER_RESTOCK) ---');
    const result1 = await adjustInventory(db, {
      variant_id: 1,
      actor_user_id: 1,
      movement_type: 'SUPPLIER_RESTOCK',
      quantity: 30,
      notes: 'Supplier delivery'
    });
    const inv1 = await db.get('SELECT available_stock FROM inventory WHERE variant_id = 1');
    const movement1 = await db.get('SELECT * FROM inventory_movements WHERE movement_id = ?', [result1.movement_id]);

    if (inv1.available_stock !== 80) throw new Error(`Expected stock 80, got ${inv1.available_stock}`);
    if (movement1.previous_quantity !== 50) throw new Error(`Expected previous_quantity 50, got ${movement1.previous_quantity}`);
    if (movement1.new_quantity !== 80) throw new Error(`Expected new_quantity 80, got ${movement1.new_quantity}`);
    if (movement1.quantity_change !== 30) throw new Error(`Expected quantity_change 30, got ${movement1.quantity_change}`);
    if (movement1.movement_type !== 'SUPPLIER_RESTOCK') throw new Error(`Expected movement_type SUPPLIER_RESTOCK, got ${movement1.movement_type}`);
    console.log('SUCCESS: Positive movements (SUPPLIER_RESTOCK) verified successfully!');

    // ─── Test 2: Negative movements (DAMAGED) ───
    console.log('\n--- TEST 2: NEGATIVE MOVEMENTS (DAMAGED) ---');
    const result2 = await adjustInventory(db, {
      variant_id: 1,
      actor_user_id: 1,
      movement_type: 'DAMAGED',
      quantity: 10,
      notes: 'Water damage'
    });
    const inv2 = await db.get('SELECT available_stock FROM inventory WHERE variant_id = 1');
    const movement2 = await db.get('SELECT * FROM inventory_movements WHERE movement_id = ?', [result2.movement_id]);

    if (inv2.available_stock !== 70) throw new Error(`Expected stock 70, got ${inv2.available_stock}`);
    if (movement2.previous_quantity !== 80) throw new Error(`Expected previous_quantity 80, got ${movement2.previous_quantity}`);
    if (movement2.new_quantity !== 70) throw new Error(`Expected new_quantity 70, got ${movement2.new_quantity}`);
    if (movement2.quantity_change !== -10) throw new Error(`Expected quantity_change -10, got ${movement2.quantity_change}`);
    if (movement2.movement_type !== 'DAMAGED') throw new Error(`Expected movement_type DAMAGED, got ${movement2.movement_type}`);
    console.log('SUCCESS: Negative movements (DAMAGED) verified successfully!');

    // ─── Test 3: Negative stock prevention ───
    console.log('\n--- TEST 3: NEGATIVE STOCK PREVENTION ---');
    let errNegative = null;
    try {
      await adjustInventory(db, {
        variant_id: 1,
        actor_user_id: 1,
        movement_type: 'INTERNAL_USAGE',
        quantity: 100, // current stock is 70
        notes: 'Excessive internal usage'
      });
    } catch (err) {
      errNegative = err;
    }
    const inv3 = await db.get('SELECT available_stock FROM inventory WHERE variant_id = 1');
    if (!errNegative) throw new Error('Expected negative stock error to be thrown');
    if (inv3.available_stock !== 70) throw new Error(`Stock should remain 70, got ${inv3.available_stock}`);
    console.log(`SUCCESS: Negative stock prevention validated (error: ${errNegative.message})!`);

    // ─── Test 4: Rollback behavior ───
    console.log('\n--- TEST 4: TRANSACTION ROLLBACK BEHAVIOR ---');
    let errRollback = null;
    try {
      await adjustInventory(db, {
        variant_id: 999, // invalid variant ID
        actor_user_id: 1,
        movement_type: 'MANUAL_CORRECTION',
        quantity: 10,
        notes: 'Failed update'
      });
    } catch (err) {
      errRollback = err;
    }
    // Verify database was not changed
    const movementsCount = await db.get('SELECT COUNT(*) as count FROM inventory_movements WHERE variant_id = 999');
    if (movementsCount.count !== 0) throw new Error('Failed adjustment should not create movement records');
    console.log(`SUCCESS: Rollback behavior verified (error: ${errRollback.message})!`);

    // ─── Test 5: Immutable history validation ───
    console.log('\n--- TEST 5: IMMUTABLE HISTORY VALIDATION ---');
    const history = await getInventoryHistory(db, 1);
    if (history.length !== 2) throw new Error(`Expected 2 movements in history, got ${history.length}`);
    if (history[0].movement_id < history[1].movement_id) throw new Error('Expected history sorted descending (newest first)');
    console.log('SUCCESS: Immutable history validated!');

    // ─── Test 6: createInventoryMovement validation ───
    console.log('\n--- TEST 6: CREATE_INVENTORY_MOVEMENT HELPER ---');
    const mid = await createInventoryMovement(db, {
      variant_id: 1,
      actor_user_id: 1,
      movement_type: 'MANUAL_CORRECTION',
      quantity_change: -5,
      previous_quantity: 70,
      new_quantity: 65,
      notes: 'Custom seed'
    });
    if (!mid) throw new Error('Expected created movement ID');
    const logged = await db.get('SELECT * FROM inventory_movements WHERE movement_id = ?', [mid]);
    if (logged.quantity_change !== -5) throw new Error('Helper did not log correct change');
    console.log('SUCCESS: createInventoryMovement helper verified!');

    // ─── Test 7: ORDER_SALE movement ───
    console.log('\n--- TEST 7: ORDER_SALE MOVEMENT ---');
    await db.run('UPDATE inventory SET available_stock = 5 WHERE variant_id = 1');
    const resultSale = await adjustInventory(db, {
      variant_id: 1,
      actor_user_id: 1,
      movement_type: 'ORDER_SALE',
      quantity: 2,
      notes: 'Sale'
    });
    const invSale = await db.get('SELECT available_stock FROM inventory WHERE variant_id = 1');
    const movementSale = await db.get('SELECT * FROM inventory_movements WHERE movement_id = ?', [resultSale.movement_id]);
    if (invSale.available_stock !== 3) throw new Error(`Expected stock 3, got ${invSale.available_stock}`);
    if (movementSale.movement_type !== 'ORDER_SALE') throw new Error(`Expected type ORDER_SALE, got ${movementSale.movement_type}`);
    if (movementSale.quantity_change !== -2) throw new Error(`Expected change -2, got ${movementSale.quantity_change}`);
    console.log('SUCCESS: ORDER_SALE movement verified!');

    // ─── Test 8: RETURN_RESTOCK movement ───
    console.log('\n--- TEST 8: RETURN_RESTOCK MOVEMENT ---');
    const resultReturn = await adjustInventory(db, {
      variant_id: 1,
      actor_user_id: 1,
      movement_type: 'RETURN_RESTOCK',
      quantity: 2,
      notes: 'Return Restock'
    });
    const invReturn = await db.get('SELECT available_stock FROM inventory WHERE variant_id = 1');
    const movementReturn = await db.get('SELECT * FROM inventory_movements WHERE movement_id = ?', [resultReturn.movement_id]);
    if (invReturn.available_stock !== 5) throw new Error(`Expected stock 5, got ${invReturn.available_stock}`);
    if (movementReturn.movement_type !== 'RETURN_RESTOCK') throw new Error(`Expected type RETURN_RESTOCK, got ${movementReturn.movement_type}`);
    if (movementReturn.quantity_change !== 2) throw new Error(`Expected change 2, got ${movementReturn.quantity_change}`);
    console.log('SUCCESS: RETURN_RESTOCK movement verified!');

    // ─── Test 9: ORDER_CANCELLATION_RESTOCK movement ───
    console.log('\n--- TEST 9: ORDER_CANCELLATION_RESTOCK MOVEMENT ---');
    await db.run('UPDATE inventory SET available_stock = 3 WHERE variant_id = 1');
    const resultCancel = await adjustInventory(db, {
      variant_id: 1,
      actor_user_id: 1,
      movement_type: 'ORDER_CANCELLATION_RESTOCK',
      quantity: 1,
      notes: 'Cancellation Restock'
    });
    const invCancel = await db.get('SELECT available_stock FROM inventory WHERE variant_id = 1');
    const movementCancel = await db.get('SELECT * FROM inventory_movements WHERE movement_id = ?', [resultCancel.movement_id]);
    if (invCancel.available_stock !== 4) throw new Error(`Expected stock 4, got ${invCancel.available_stock}`);
    if (movementCancel.movement_type !== 'ORDER_CANCELLATION_RESTOCK') throw new Error(`Expected type ORDER_CANCELLATION_RESTOCK, got ${movementCancel.movement_type}`);
    if (movementCancel.quantity_change !== 1) throw new Error(`Expected change 1, got ${movementCancel.quantity_change}`);
    console.log('SUCCESS: ORDER_CANCELLATION_RESTOCK movement verified!');

    // ─── Test 10: Notes validation length constraint ───
    console.log('\n--- TEST 10: NOTES LENGTH VALIDATION ---');
    let errNotesMC = null;
    try {
      await adjustInventory(db, {
        variant_id: 1,
        actor_user_id: 1,
        movement_type: 'MANUAL_CORRECTION',
        quantity: 5,
        notes: 'Short'
      });
    } catch (err) {
      errNotesMC = err;
    }
    if (!errNotesMC) throw new Error('Expected note length error to be thrown for short notes');
    console.log(`SUCCESS: Note length validation constraint verified (error: ${errNotesMC.message})!`);

  } finally {
    await db.close();
    // Cleanup test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }

  console.log('\nALL PHASE 6B INVENTORY OPERATIONS TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
