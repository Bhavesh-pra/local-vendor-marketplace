const path = require('path');
const {open} = require('sqlite');
const sqlite3 = require('sqlite3');

let database = null;

const wrapDbWithTelemetry = (db) => {
  const originalRun = db.run.bind(db);
  const originalGet = db.get.bind(db);
  const originalAll = db.all.bind(db);
  const originalExec = db.exec.bind(db);

  const measureAndRun = async (originalMethod, sql, ...params) => {
    const start = process.hrtime();
    try {
      return await originalMethod(sql, ...params);
    } finally {
      const diff = process.hrtime(start);
      const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6);
      if (durationMs > 200) {
        console.warn(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'WARNING',
          type: 'DB_SLOW_QUERY',
          duration_ms: durationMs,
          sql: typeof sql === 'string' ? sql.substring(0, 500) : '[Statement]'
        }));
      }
    }
  };

  db.run = (sql, ...params) => measureAndRun(originalRun, sql, ...params);
  db.get = (sql, ...params) => measureAndRun(originalGet, sql, ...params);
  db.all = (sql, ...params) => measureAndRun(originalAll, sql, ...params);
  db.exec = (sql) => measureAndRun(originalExec, sql);
};

const initDb = async () => {
  const dbPath = process.env.DATABASE_PATH ? path.resolve(__dirname, process.env.DATABASE_PATH) : path.join(__dirname, 'ecommerce.sqlite');
  database = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
  wrapDbWithTelemetry(database);

  // Clean up any duplicate active carts (keep only the latest one per user)
  await database.run(`
    UPDATE cart
    SET status = 'abandoned'
    WHERE status = 'active'
    AND cart_id NOT IN (
      SELECT MAX(cart_id)
      FROM cart
      WHERE status = 'active'
      GROUP BY user_id
    )
  `);

  // Enforce: at most one active cart per user
  await database.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_cart_per_user ON cart(user_id) WHERE status = 'active'`
  );

  // ─── Admin: Order Requests table ────────────────────────────────────────
  // Customers can request cancellation, return, or replacement.
  // Admin approves or rejects. admin_note is shown to the customer.
  await database.run(`
    CREATE TABLE IF NOT EXISTS order_requests (
      request_id   INTEGER PRIMARY KEY,
      order_id     INTEGER NOT NULL,
      user_id      INTEGER NOT NULL,
      request_type TEXT NOT NULL CHECK (request_type IN ('cancel','return','replacement')),
      reason       TEXT,
      status       TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected')),
      admin_note   TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at  TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (user_id)  REFERENCES users(user_id)  ON UPDATE CASCADE ON DELETE CASCADE
    )
  `);

  // ─── Order Events table ────────────────────────────────────────
  await database.run(`
    CREATE TABLE IF NOT EXISTS order_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id     INTEGER NOT NULL,
      status       TEXT NOT NULL CHECK (status IN ('placed','confirmed','processing','shipped','delivered','cancelled','returned')),
      message      TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON UPDATE CASCADE ON DELETE CASCADE
    )
  `);

  // ─── Phase 2A Save For Later Table ────────────────────────────────────────
  await database.run(`
    CREATE TABLE IF NOT EXISTS saved_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      variant_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON UPDATE CASCADE ON DELETE CASCADE
    )
  `);

  await database.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_saved_items_user_variant ON saved_items(user_id, variant_id)
  `);

  // Enforce: at most one active alert of a given type per variant
  await database.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_active_alerts_per_variant ON alerts(type, variant_id) WHERE resolved_at IS NULL`
  );

  // ─── Phase 1S.1 Schema Migrations ─────────────────────────────────────────

  // Helper to safely add column if not exists
  const addColumnIfNotExists = async (tableName, columnName, columnDef) => {
    try {
      const info = await database.all(`PRAGMA table_info(${tableName})`);
      const exists = info.some(col => col.name === columnName);
      if (!exists) {
        await database.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
        console.log(`Column ${columnName} added to ${tableName}`);
      }
    } catch (e) {
      console.error(`Error adding column ${columnName} to ${tableName}:`, e.message);
    }
  };

  // Add columns to products
  await addColumnIfNotExists('products', 'brand', 'TEXT');
  await addColumnIfNotExists('products', 'short_description', 'TEXT');
  await addColumnIfNotExists('products', 'slug', 'TEXT');
  await addColumnIfNotExists('products', 'mrp', 'NUMERIC');
  await addColumnIfNotExists('products', 'badge', 'TEXT');
  await addColumnIfNotExists('products', 'cost_price', 'NUMERIC');
  try {
    await database.run(`
      UPDATE products
      SET cost_price = ROUND(selling_price * 0.6, 2)
      WHERE cost_price IS NULL OR cost_price = 0
    `);
  } catch (err) {
    console.error("Error backfilling cost_price:", err.message);
  }

  // Create unique index on slug (SQLite doesn't support adding UNIQUE constraints via ALTER TABLE directly)
  await database.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_products_slug ON products(slug)`);

  // Add columns to product_variants
  await addColumnIfNotExists('product_variants', 'version', 'TEXT');
  await addColumnIfNotExists('product_variants', 'weight', 'TEXT');
  await addColumnIfNotExists('product_variants', 'storage', 'TEXT');
  await addColumnIfNotExists('product_variants', 'model', 'TEXT');
  await addColumnIfNotExists('product_variants', 'barcode', 'TEXT');
  await addColumnIfNotExists('product_variants', 'mrp_override', 'NUMERIC');

  // Create child tables
  await database.run(`
    CREATE TABLE IF NOT EXISTS product_attributes (
      attribute_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      INTEGER NOT NULL,
      attribute_name  TEXT NOT NULL,
      attribute_value TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE CASCADE
    )
  `);
  await addColumnIfNotExists('product_attributes', 'is_highlight', 'INTEGER DEFAULT 0');

  await database.run(`
    CREATE TABLE IF NOT EXISTS product_warranty (
      warranty_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id       INTEGER NOT NULL UNIQUE,
      warranty_period  TEXT,
      warranty_type    TEXT,
      replacement_days INTEGER DEFAULT 0,
      return_days      INTEGER DEFAULT 0,
      description      TEXT,
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE CASCADE
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS product_shipping (
      shipping_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id     INTEGER NOT NULL UNIQUE,
      weight         NUMERIC,
      length         NUMERIC,
      width          NUMERIC,
      height         NUMERIC,
      shipping_class TEXT,
      cod_available  INTEGER DEFAULT 0 CHECK (cod_available IN (0,1)),
      free_shipping  INTEGER DEFAULT 0 CHECK (free_shipping IN (0,1)),
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE CASCADE
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS product_media (
      media_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER NOT NULL,
      variant_id  INTEGER,
      media_type  TEXT NOT NULL CHECK (media_type IN ('image','video')),
      file_path   TEXT NOT NULL,
      alt_text    TEXT,
      position    INTEGER NOT NULL DEFAULT 0,
      is_primary  INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON UPDATE CASCADE ON DELETE SET NULL
    )
  `);

  // Create indexes for performance
  await database.run(`CREATE INDEX IF NOT EXISTS ix_product_attributes_product ON product_attributes(product_id)`);
  await database.run(`CREATE INDEX IF NOT EXISTS ix_product_media_product ON product_media(product_id)`);
  await database.run(`CREATE INDEX IF NOT EXISTS ix_product_media_variant ON product_media(variant_id)`);

  // Self-healing: Back-fill unique slugs for any existing products that lack them
  try {
    const productsWithoutSlugs = await database.all("SELECT product_id, product_name FROM products WHERE slug IS NULL");
    for (const prod of productsWithoutSlugs) {
      const cleanSlug = prod.product_name.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + prod.product_id;
      await database.run("UPDATE products SET slug = ? WHERE product_id = ?", [cleanSlug, prod.product_id]);
      console.log(`Back-filled slug '${cleanSlug}' for product ID ${prod.product_id}`);
    }
  } catch (err) {
    console.error("Error back-filling product slugs:", err.message);
  }

  // Self-healing: Back-fill MRP values for products/variants that lack them
  try {
    await database.run("UPDATE products SET mrp = selling_price WHERE mrp IS NULL OR mrp = 0");
    await database.run("UPDATE product_variants SET mrp_override = price_override WHERE mrp_override IS NULL AND price_override IS NOT NULL");
    console.log("Self-healed database: Back-filled MRP and variant MRP overrides");
  } catch (err) {
    console.error("Error back-filling MRP values:", err.message);
  }

  // ─── Phase 4A FTS5 Search Initialization & Triggers ───────────────────────
  try {
    // Create FTS5 virtual table
    await database.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
        product_id UNINDEXED,
        product_name,
        short_description,
        description,
        brand,
        category_name
      )
    `);

    // Create sync triggers
    await database.run(`
      CREATE TRIGGER IF NOT EXISTS trg_products_insert AFTER INSERT ON products
      BEGIN
        INSERT INTO products_fts(product_id, product_name, short_description, description, brand, category_name)
        VALUES (
          new.product_id,
          new.product_name,
          IFNULL(new.short_description, ''),
          new.description,
          IFNULL(new.brand, ''),
          IFNULL((SELECT category_name FROM categories WHERE category_id = new.category_id), '')
        );
      END;
    `);

    await database.run(`
      CREATE TRIGGER IF NOT EXISTS trg_products_update AFTER UPDATE ON products
      BEGIN
        UPDATE products_fts
        SET product_name = new.product_name,
            short_description = IFNULL(new.short_description, ''),
            description = new.description,
            brand = IFNULL(new.brand, ''),
            category_name = IFNULL((SELECT category_name FROM categories WHERE category_id = new.category_id), '')
        WHERE product_id = old.product_id;
      END;
    `);

    await database.run(`
      CREATE TRIGGER IF NOT EXISTS trg_products_delete AFTER DELETE ON products
      BEGIN
        DELETE FROM products_fts WHERE product_id = old.product_id;
      END;
    `);

    await database.run(`
      CREATE TRIGGER IF NOT EXISTS trg_categories_update AFTER UPDATE OF category_name ON categories
      BEGIN
        UPDATE products_fts
        SET category_name = new.category_name
        WHERE product_id IN (SELECT product_id FROM products WHERE category_id = new.category_id);
      END;
    `);

    // Self-healing FTS5 backfill logic
    await database.run(`
      INSERT INTO products_fts(product_id, product_name, short_description, description, brand, category_name)
      SELECT p.product_id, p.product_name, IFNULL(p.short_description, ''), p.description, IFNULL(p.brand, ''), IFNULL(c.category_name, '')
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.product_id NOT IN (SELECT product_id FROM products_fts)
    `);

    console.log("FTS5 table and triggers initialized successfully.");
  } catch (err) {
    console.error("Error setting up FTS5 search index:", err.message);
  }

  // ─── Phase 4C Telemetry Initialization ─────────────────────────────────────
  try {
    await database.run(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        user_id INTEGER NULL,
        session_id TEXT NOT NULL,
        product_id INTEGER NULL,
        category_id INTEGER NULL,
        metadata TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indices to optimize queries in Phase 4D
    await database.run(`CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_analytics_events_product_id ON analytics_events(product_id)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at)`);

    console.log("Telemetry database table and indices initialized successfully.");
  } catch (err) {
    console.error("Error setting up telemetry table:", err.message);
  }

  // ─── Phase 5A Return Policies & Order delivered_at Initialization ─────────
  try {
    // 1. Create return_policies table
    await database.run(`
      CREATE TABLE IF NOT EXISTS return_policies (
        policy_id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL UNIQUE,
        type        TEXT NOT NULL CHECK (type IN ('returnable', 'replacement_only', 'non_returnable')),
        days        INTEGER NOT NULL CHECK (days >= 0),
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // 2. Add return_policy_id column to products table
    await addColumnIfNotExists('products', 'return_policy_id', 'INTEGER REFERENCES return_policies(policy_id) ON UPDATE CASCADE ON DELETE SET NULL');

    // 3. Add delivered_at column to orders table
    await addColumnIfNotExists('orders', 'delivered_at', 'DATETIME NULL');

    // 4. Seed default return policies
    const policiesCount = await database.get('SELECT COUNT(*) as count FROM return_policies');
    if (policiesCount.count === 0) {
      await database.run(`
        INSERT INTO return_policies (name, type, days) VALUES
          ('Returnable 7 Days', 'returnable', 7),
          ('Returnable 10 Days', 'returnable', 10),
          ('Returnable 30 Days', 'returnable', 30),
          ('Replacement Only 7 Days', 'replacement_only', 7),
          ('Non Returnable', 'non_returnable', 0)
      `);
      console.log('Seeded default return policies.');
    }

    // 5. Self-healing: Back-fill return_policy_id for existing products
    const defaultPolicy = await database.get("SELECT policy_id FROM return_policies WHERE name = 'Returnable 30 Days'");
    if (defaultPolicy) {
      await database.run(
        "UPDATE products SET return_policy_id = ? WHERE return_policy_id IS NULL",
        [defaultPolicy.policy_id]
      );
      console.log("Self-healed products return_policy_id backfill.");
    }

    // 6. Self-healing: Back-fill delivered_at for historical delivered orders
    await database.run(`
      UPDATE orders
      SET delivered_at = COALESCE(
        (SELECT created_at FROM order_events WHERE order_events.order_id = orders.order_id AND status = 'delivered' ORDER BY created_at DESC LIMIT 1),
        updated_at
      )
      WHERE status = 'delivered' AND delivered_at IS NULL
    `);
    console.log("Self-healed orders delivered_at backfill.");

    // 7. Create returns table
    await database.run(`
      CREATE TABLE IF NOT EXISTS returns (
        return_id          INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id           INTEGER NOT NULL,
        order_item_id      INTEGER NOT NULL,
        variant_id         INTEGER NOT NULL,
        user_id            INTEGER NOT NULL,
        request_type       TEXT NOT NULL CHECK (request_type IN ('return', 'replacement')),
        reason_code        TEXT NOT NULL CHECK (reason_code IN ('DAMAGED_ITEM', 'WRONG_ITEM_RECEIVED', 'MISSING_PARTS', 'NOT_AS_DESCRIBED', 'QUALITY_ISSUE', 'SIZE_ISSUE', 'CHANGED_MIND', 'OTHER')),
        reason_description TEXT,
        status             TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REFUNDED', 'REPLACEMENT_SHIPPED', 'REFUND_COMPLETED', 'REPLACEMENT_COMPLETED')),
        admin_notes        TEXT,
        requested_at       TEXT,
        approved_at        TEXT,
        rejected_at        TEXT,
        completed_at       TEXT,
        created_at         TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);

    // 8. Create return_events table
    await database.run(`
      CREATE TABLE IF NOT EXISTS return_events (
        event_id         INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id        INTEGER NOT NULL,
        previous_status  TEXT,
        new_status       TEXT NOT NULL,
        actor_user_id    INTEGER,
        actor_type       TEXT NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system')),
        notes            TEXT,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (return_id) REFERENCES returns(return_id) ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);

    // 9. Create indexes for performance and uniqueness
    await database.run(`CREATE INDEX IF NOT EXISTS idx_returns_order_variant ON returns(order_id, variant_id)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_return_events_return_id ON return_events(return_id)`);
    
    // Concurrency guard: partial unique index for active returns
    await database.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_returns_active_unique
      ON returns(order_id, variant_id)
      WHERE status <> 'REJECTED'
      AND status <> 'REFUND_COMPLETED'
      AND status <> 'REPLACEMENT_COMPLETED'
    `);

    console.log("Phase 5B returns database structures initialized successfully.");

    // ─── Phase 5C Verified Buyer & Review Trust Schema Update ─────────────────
    const reviewsTableInfo = await database.all("PRAGMA table_info(reviews)");
    const hasOrderItemId = reviewsTableInfo.some(col => col.name === 'order_item_id');

    if (!hasOrderItemId) {
      console.log("Migrating reviews table for Phase 5C...");
      const tableCheck = await database.get("SELECT name FROM sqlite_master WHERE type='table' AND name='reviews'");
      
      if (tableCheck) {
        await database.run("ALTER TABLE reviews RENAME TO reviews_old");
      }

      await database.run(`
        CREATE TABLE reviews (
          review_id            INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id           INTEGER NOT NULL,
          user_id              INTEGER NOT NULL,
          order_item_id        INTEGER,
          rating               INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
          title                TEXT,
          comment              TEXT,
          is_verified_purchase INTEGER NOT NULL DEFAULT 1 CHECK (is_verified_purchase IN (0, 1)),
          helpful_count        INTEGER NOT NULL DEFAULT 0,
          status               TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'hidden')),
          created_at           TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (product_id) REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
          FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id) ON UPDATE CASCADE ON DELETE CASCADE
        )
      `);

      if (tableCheck) {
        await database.run(`
          INSERT INTO reviews (product_id, user_id, rating, comment, is_verified_purchase, created_at, updated_at)
          SELECT product_id, user_id, rating, comment, 0, created_at, updated_at
          FROM reviews_old
        `);
        await database.run("DROP TABLE reviews_old");
        console.log("Migrated historical reviews to new reviews schema.");
      }
    }

    // Create review_images table
    await database.run(`
      CREATE TABLE IF NOT EXISTS review_images (
        image_id    INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id   INTEGER NOT NULL,
        image_url   TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);

    // Create review_helpful_votes table
    await database.run(`
      CREATE TABLE IF NOT EXISTS review_helpful_votes (
        vote_id     INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id   INTEGER NOT NULL,
        user_id     INTEGER NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
        UNIQUE (review_id, user_id)
      )
    `);

    // Create review_moderation_logs table
    await database.run(`
      CREATE TABLE IF NOT EXISTS review_moderation_logs (
        log_id           INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id        INTEGER NOT NULL,
        previous_status  TEXT,
        new_status       TEXT NOT NULL,
        actor_user_id    INTEGER NOT NULL,
        notes            TEXT,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);

    // Create indexes for review trust tables
    await database.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_order_item_user
      ON reviews(order_item_id, user_id)
      WHERE order_item_id IS NOT NULL
    `);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_review_images_review_id ON review_images(review_id)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_review_user ON review_helpful_votes(review_id, user_id)`);

    // Run historical backfill verifications
    await database.run(`
      UPDATE reviews
      SET is_verified_purchase = 1,
          order_item_id = (
            SELECT oi.order_item_id
            FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN product_variants pv ON oi.variant_id = pv.variant_id
            WHERE o.user_id = reviews.user_id
              AND pv.product_id = reviews.product_id
              AND o.status = 'delivered'
              AND datetime(reviews.created_at) >= datetime(o.delivered_at)
            LIMIT 1
          )
      WHERE EXISTS (
        SELECT 1
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        WHERE o.user_id = reviews.user_id
          AND pv.product_id = reviews.product_id
          AND o.status = 'delivered'
          AND datetime(reviews.created_at) >= datetime(o.delivered_at)
      )
    `);
    console.log("Self-healed historical reviews verification backfill.");

    console.log("Phase 5C reviews database structures initialized successfully.");
  } catch (err) {
    console.error("Error setting up Phase 5C reviews database structures:", err.message);
  }

  // ─── Phase 5D: Coupons & Promotions Engine ────────────────────────────────
  try {
    // 1. Alter orders table to add coupon columns if missing
    const ordersInfo = await database.all("PRAGMA table_info(orders)");
    const ordersColumns = ordersInfo.map(col => col.name);

    if (!ordersColumns.includes('coupon_id')) {
      await database.run("ALTER TABLE orders ADD COLUMN coupon_id INTEGER DEFAULT NULL");
      console.log("Column coupon_id added to orders");
    }
    if (!ordersColumns.includes('discount_amount')) {
      await database.run("ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0");
      console.log("Column discount_amount added to orders");
    }
    if (!ordersColumns.includes('coupon_code_snapshot')) {
      await database.run("ALTER TABLE orders ADD COLUMN coupon_code_snapshot TEXT DEFAULT NULL");
      console.log("Column coupon_code_snapshot added to orders");
    }

    // 2. Create coupons table
    await database.run(`
      CREATE TABLE IF NOT EXISTS coupons (
        coupon_id INTEGER PRIMARY KEY AUTOINCREMENT,
        coupon_code TEXT UNIQUE NOT NULL,
        coupon_type TEXT NOT NULL CHECK (coupon_type IN ('fixed', 'percentage', 'free_shipping')),
        discount_value REAL NOT NULL,
        min_order_value REAL DEFAULT 0,
        max_discount_amount REAL,
        usage_limit INTEGER,
        per_user_limit INTEGER DEFAULT 1,
        expiration_date TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // 3. Create coupon_redemptions table (immutable)
    await database.run(`
      CREATE TABLE IF NOT EXISTS coupon_redemptions (
        redemption_id INTEGER PRIMARY KEY AUTOINCREMENT,
        coupon_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        discount_amount REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (coupon_id) REFERENCES coupons(coupon_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT
      )
    `);

    // 4. Create coupon_categories table
    await database.run(`
      CREATE TABLE IF NOT EXISTS coupon_categories (
        coupon_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        PRIMARY KEY (coupon_id, category_id),
        FOREIGN KEY (coupon_id) REFERENCES coupons(coupon_id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(category_id) ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);

    // 5. Create coupon_products table
    await database.run(`
      CREATE TABLE IF NOT EXISTS coupon_products (
        coupon_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        PRIMARY KEY (coupon_id, product_id),
        FOREIGN KEY (coupon_id) REFERENCES coupons(coupon_id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);

    // 6. Create indexes
    await database.run(`CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user_coupon ON coupon_redemptions(user_id, coupon_id)`);

    // 7. Seed initial promo codes
    await database.run(`
      INSERT OR IGNORE INTO coupons (coupon_code, coupon_type, discount_value, min_order_value, max_discount_amount, per_user_limit, usage_limit)
      VALUES ('WELCOME10', 'percentage', 10, 500, 200, 1, 1000)
    `);
    await database.run(`
      INSERT OR IGNORE INTO coupons (coupon_code, coupon_type, discount_value, min_order_value, max_discount_amount, per_user_limit, usage_limit)
      VALUES ('FLAT150', 'fixed', 150, 1000, NULL, 3, 500)
    `);
    await database.run(`
      INSERT OR IGNORE INTO coupons (coupon_code, coupon_type, discount_value, min_order_value, max_discount_amount, per_user_limit, usage_limit)
      VALUES ('FREESHIP', 'free_shipping', 0, 500, NULL, 5, 2000)
    `);

    console.log("Phase 5D coupons database structures initialized successfully.");
  } catch (err) {
    console.error("Error setting up Phase 5D coupons database structures:", err.message);
  }

  // ─── Phase 5E Notifications ──────────────────────────────────────────────
  try {
    await database.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id         INTEGER NOT NULL,
        type            TEXT NOT NULL,
        title           TEXT NOT NULL,
        message         TEXT NOT NULL,
        metadata        TEXT,
        event_key       TEXT UNIQUE NOT NULL,
        is_read         INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        read_at         TEXT DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read)`);
    console.log("Phase 5E notifications database structures initialized successfully.");
  } catch (err) {
    console.error("Error setting up Phase 5E notifications database structures:", err.message);
  }

  // ─── Phase 6B Inventory Movements ──────────────────────────────────────────
  try {
    let dropAndRecreateMovements = false;
    const info = await database.all("PRAGMA table_info(inventory_movements)");
    if (info.length > 0) {
      const hasActorUserId = info.some(col => col.name === 'actor_user_id');
      if (!hasActorUserId) {
        dropAndRecreateMovements = true;
      }
    } else {
      dropAndRecreateMovements = true;
    }

    if (dropAndRecreateMovements) {
      await database.run("DROP TABLE IF EXISTS inventory_movements");
      await database.run(`
        CREATE TABLE inventory_movements (
            movement_id        INTEGER PRIMARY KEY AUTOINCREMENT,
            variant_id         INTEGER NOT NULL,
            actor_user_id      INTEGER NOT NULL,
            movement_type      TEXT NOT NULL,
            quantity_change    INTEGER NOT NULL,
            previous_quantity  INTEGER NOT NULL,
            new_quantity       INTEGER NOT NULL,
            notes              TEXT,
            created_at         TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id),
            FOREIGN KEY (actor_user_id) REFERENCES users(user_id)
        )
      `);
      console.log("Created inventory_movements table with Phase 6B schema.");
    }

    await database.run("CREATE INDEX IF NOT EXISTS idx_inventory_variant ON inventory_movements(variant_id)");
    await database.run("CREATE INDEX IF NOT EXISTS idx_inventory_created ON inventory_movements(created_at)");
  } catch (err) {
    console.error("Error setting up Phase 6B inventory movements database structures:", err.message);
  }

  // ─── Phase 6C Purchase Orders & Supplier Procurement ─────────────────────
  try {
    await database.run(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
          po_id INTEGER PRIMARY KEY AUTOINCREMENT,
          supplier_id INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'DRAFT'
              CHECK(status IN (
                  'DRAFT',
                  'SENT',
                  'ACKNOWLEDGED',
                  'PARTIALLY_RECEIVED',
                  'RECEIVED',
                  'CANCELLED'
              )),
          notes TEXT,
          created_by INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT(datetime('now')),
          updated_at TEXT NOT NULL DEFAULT(datetime('now')),
          FOREIGN KEY(supplier_id) REFERENCES users(user_id),
          FOREIGN KEY(created_by) REFERENCES users(user_id)
      )
    `);

    await database.run(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
          po_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
          po_id INTEGER NOT NULL,
          variant_id INTEGER NOT NULL,
          ordered_quantity INTEGER NOT NULL,
          received_quantity INTEGER NOT NULL DEFAULT 0,
          unit_cost REAL,
          created_at TEXT NOT NULL DEFAULT(datetime('now')),
          FOREIGN KEY(po_id) REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
          FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id)
      )
    `);

    await database.run("CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id)");
    await database.run("CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status)");
    await database.run("CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(po_id)");
    await database.run("CREATE INDEX IF NOT EXISTS idx_purchase_order_items_variant ON purchase_order_items(variant_id)");

    // Add columns to purchase_orders
    await addColumnIfNotExists('purchase_orders', 'sent_at', 'TEXT');
    await addColumnIfNotExists('purchase_orders', 'acknowledged_at', 'TEXT');
    await addColumnIfNotExists('purchase_orders', 'received_at', 'TEXT');

    // Self-healing backfill for purchase_orders columns
    try {
      await database.run(`
        UPDATE purchase_orders
        SET sent_at = created_at
        WHERE sent_at IS NULL AND status IN ('SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')
      `);
      await database.run(`
        UPDATE purchase_orders
        SET acknowledged_at = updated_at
        WHERE acknowledged_at IS NULL AND status IN ('ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED')
      `);
      await database.run(`
        UPDATE purchase_orders
        SET received_at = updated_at
        WHERE received_at IS NULL AND status = 'RECEIVED'
      `);
      console.log("Self-healed purchase_orders status timestamps backfill.");
    } catch (backfillErr) {
      console.error("Error back-filling purchase_orders timestamps:", backfillErr.message);
    }

    console.log("Phase 6C purchase orders database structures initialized successfully.");
  } catch (err) {
    console.error("Error setting up Phase 6C purchase orders database structures:", err.message);
  }

  // ─── Phase 7 Business Intelligence & Insights Initialization ───────────
  try {
    // 1. Create API metrics tables
    await database.run(`
      CREATE TABLE IF NOT EXISTS api_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        duration_ms REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_api_metrics_created_at ON api_metrics(created_at)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_api_metrics_path ON api_metrics(path)`);

    await database.run(`
      CREATE TABLE IF NOT EXISTS daily_api_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        request_count INTEGER NOT NULL,
        avg_duration_ms REAL NOT NULL,
        max_duration_ms REAL NOT NULL
      )
    `);
    await database.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_api_metrics ON daily_api_metrics(date, method, path, status_code)`);

    // 2. Create Event summaries tables
    await database.run(`
      CREATE TABLE IF NOT EXISTS daily_event_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        event_name TEXT NOT NULL,
        product_id INTEGER NOT NULL DEFAULT -1,
        category_id INTEGER NOT NULL DEFAULT -1,
        event_count INTEGER NOT NULL
      )
    `);
    await database.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_event_metrics ON daily_event_metrics(date, event_name, product_id, category_id)`);

    // 3. Auto-aggregate completed historical days on startup
    console.log("[Analytics Setup] Running startup auto-aggregation and pruning...");

    // Aggregate completed raw API metrics
    await database.run(`
      INSERT OR IGNORE INTO daily_api_metrics (date, method, path, status_code, request_count, avg_duration_ms, max_duration_ms)
      SELECT DATE(created_at) AS d, method, path, status_code, COUNT(*), AVG(duration_ms), MAX(duration_ms)
      FROM api_metrics
      WHERE created_at < DATE('now')
      GROUP BY d, method, path, status_code
    `);

    // Prune raw API metrics older than 30 days
    const prunedApi = await database.run(`
      DELETE FROM api_metrics WHERE created_at < datetime('now', '-30 days')
    `);
    if (prunedApi.changes > 0) {
      console.log(`[Analytics Setup] Pruned ${prunedApi.changes} raw api_metrics rows older than 30 days.`);
    }

    // Aggregate completed raw events
    await database.run(`
      INSERT OR IGNORE INTO daily_event_metrics (date, event_name, product_id, category_id, event_count)
      SELECT DATE(created_at) AS d, event_name, IFNULL(product_id, -1), IFNULL(category_id, -1), COUNT(*)
      FROM analytics_events
      WHERE created_at < DATE('now')
      GROUP BY d, event_name, product_id, category_id
    `);

    // Prune raw events older than 90 days
    const prunedEvents = await database.run(`
      DELETE FROM analytics_events WHERE created_at < datetime('now', '-90 days')
    `);
    if (prunedEvents.changes > 0) {
      console.log(`[Analytics Setup] Pruned ${prunedEvents.changes} raw analytics_events rows older than 90 days.`);
    }

    console.log("[Analytics Setup] Phase 7 metrics tables & pruning routines initialized.");
  } catch (err) {
    console.error("Error setting up Phase 7 metrics tables:", err.message);
  }

  // ─── Phase 8 Mock Payment Ecosystem Initialization ─────────────────────
  try {
    // 1. Platform Settings Configuration
    await database.run(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default settings
    await database.run("INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('commission_percentage', '10')");
    await database.run("INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('fixed_transaction_fee', '15')");
    await database.run("INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('minimum_commission', '0')");
    await database.run("INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('maximum_commission', '10000')");
    await database.run("INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('schema_version', '7')");

    // Fetch schema version
    const versionRow = await database.get("SELECT value FROM platform_settings WHERE key = 'schema_version'");
    const schemaVersion = parseInt(versionRow ? versionRow.value : '7', 10);

    if (schemaVersion < 8) {
      console.log("[Phase 8 Migration] Running orders check constraint migration...");
      
      // Disable foreign keys temporarily
      await database.run("PRAGMA foreign_keys = OFF");
      await database.run("BEGIN TRANSACTION");

      try {
        // Rename orders to orders_old
        await database.run("ALTER TABLE orders RENAME TO orders_old");

        // Create new orders table with relaxed CHECK constraints
        await database.run(`
          CREATE TABLE orders (
            order_id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id             INTEGER NOT NULL,
            order_number        TEXT NOT NULL UNIQUE,
            status              TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','processing','shipped','delivered','cancelled','returned')),
            payment_method      TEXT NOT NULL
                                CHECK (payment_method IN ('COD','UPI','CARD','WALLET')),
            payment_status      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (payment_status IN ('pending','paid','failed','refunded','partially_refunded')),
            subtotal_amount     NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
            shipping_amount     NUMERIC NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
            tax_amount          NUMERIC NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
            total_amount        NUMERIC NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
            customer_name       TEXT NOT NULL,
            customer_email      TEXT NOT NULL,
            customer_phone      TEXT,
            address_line_1      TEXT,
            address_line_2      TEXT,
            city                TEXT,
            state               TEXT,
            postal_code         TEXT,
            country_code        TEXT NOT NULL DEFAULT 'IN',
            placed_at           TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
            coupon_id           INTEGER DEFAULT NULL,
            discount_amount     REAL DEFAULT 0,
            coupon_code_snapshot TEXT DEFAULT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT
          )
        `);

        // Copy data from orders_old to orders
        await database.run(`
          INSERT INTO orders (
            order_id, user_id, order_number, status, payment_method, payment_status,
            subtotal_amount, shipping_amount, tax_amount, total_amount,
            customer_name, customer_email, customer_phone, address_line_1, address_line_2,
            city, state, postal_code, country_code, placed_at, updated_at,
            coupon_id, discount_amount, coupon_code_snapshot
          )
          SELECT 
            order_id, user_id, order_number, status, payment_method, payment_status,
            subtotal_amount, shipping_amount, tax_amount, total_amount,
            customer_name, customer_email, customer_phone, address_line_1, address_line_2,
            city, state, postal_code, country_code, placed_at, updated_at,
            coupon_id, discount_amount, coupon_code_snapshot
          FROM orders_old
        `);

        // Drop orders_old
        await database.run("DROP TABLE orders_old");

        // Recreate indexes on orders
        await database.run("CREATE INDEX IF NOT EXISTS ix_orders_user_date ON orders(user_id, placed_at)");
        await database.run("CREATE INDEX IF NOT EXISTS ix_orders_status_payment ON orders(status, payment_status)");

        // Update schema version to 8
        await database.run("UPDATE platform_settings SET value = '8' WHERE key = 'schema_version'");

        await database.run("COMMIT");
        console.log("[Phase 8 Migration] orders check constraint migration completed successfully.");
      } catch (migrationErr) {
        await database.run("ROLLBACK");
        console.error("[Phase 8 Migration] Migration failed, rolled back:", migrationErr.message);
        throw migrationErr;
      } finally {
        await database.run("PRAGMA foreign_keys = ON");
      }
    }

    // 2. Create Payments Table with Idempotency
    await database.run(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(order_id),
        payment_method TEXT NOT NULL CHECK(payment_method IN ('COD', 'UPI', 'CARD', 'WALLET')),
        status TEXT NOT NULL CHECK(status IN ('created', 'initiated', 'processing', 'authorized', 'captured', 'completed', 'failed', 'cancelled', 'expired', 'refunded', 'partially_refunded')),
        amount REAL NOT NULL,
        transaction_reference TEXT UNIQUE,
        idempotency_key TEXT UNIQUE,
        gateway_outcome TEXT CHECK(gateway_outcome IN ('success', 'failure', 'timeout', 'cancelled', 'expired', 'pending')),
        failure_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Create Payment Events (Timeline logs)
    await database.run(`
      CREATE TABLE IF NOT EXISTS payment_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL REFERENCES payments(payment_id),
        previous_state TEXT,
        new_state TEXT NOT NULL,
        actor TEXT NOT NULL CHECK(actor IN ('system', 'customer', 'admin')),
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Create Refunds Table with Idempotency
    await database.run(`
      CREATE TABLE IF NOT EXISTS refunds (
        refund_id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL REFERENCES payments(payment_id),
        amount REAL NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('requested', 'approved', 'processing', 'completed', 'rejected', 'failed')),
        rejection_reason TEXT,
        admin_notes TEXT,
        idempotency_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Ensure admin_notes column exists on older databases (idempotent ALTER)
    await database.run(`ALTER TABLE refunds ADD COLUMN admin_notes TEXT`).catch(() => {/* column already exists */});

    // 4b. Refund Disbursements — tracks where non-wallet refunds money goes
    // For WALLET refunds, wallet_transactions is the source of truth.
    // For COD/UPI/CARD, the admin must manually transfer and mark this record as completed.
    await database.run(`
      CREATE TABLE IF NOT EXISTS refund_disbursements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        refund_id INTEGER NOT NULL REFERENCES refunds(refund_id),
        order_id INTEGER NOT NULL REFERENCES orders(order_id),
        user_id INTEGER NOT NULL REFERENCES users(user_id),
        payment_method TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_manual'
                   CHECK(status IN ('pending_manual', 'completed', 'failed', 'cancelled')),
        notes TEXT,
        completed_at DATETIME,
        idempotency_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Create Wallet Transactions Ledger
    await database.run(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(user_id),
        type TEXT NOT NULL CHECK(type IN ('deposit', 'payment', 'refund', 'adjustment_credit', 'adjustment_debit')),
        amount REAL NOT NULL,
        reference_id TEXT,
        idempotency_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Create Supplier Payouts Table
    await database.run(`
      CREATE TABLE IF NOT EXISTS supplier_payouts (
        payout_id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL REFERENCES users(user_id),
        order_id INTEGER NOT NULL REFERENCES orders(order_id),
        amount REAL NOT NULL,
        commission_deducted REAL NOT NULL,
        platform_fee_deducted REAL NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'scheduled', 'processing', 'completed', 'failed')),
        timeline TEXT,
        idempotency_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Create Platform-Wide Financial Audit Logs
    await database.run(`
      CREATE TABLE IF NOT EXISTS financial_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('payment', 'refund', 'refund_disbursement', 'payout', 'wallet_transaction')),
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL CHECK(actor IN ('system', 'customer', 'admin')),
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const financialEventsSchema = await database.get(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'financial_events'"
    );
    if (
      financialEventsSchema?.sql &&
      !financialEventsSchema.sql.includes("'refund_disbursement'")
    ) {
      await database.run('ALTER TABLE financial_events RENAME TO financial_events_legacy');
      await database.run(`
        CREATE TABLE financial_events (
          event_id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL CHECK(entity_type IN ('payment', 'refund', 'refund_disbursement', 'payout', 'wallet_transaction')),
          entity_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          actor TEXT NOT NULL CHECK(actor IN ('system', 'customer', 'admin')),
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await database.run(`
        INSERT INTO financial_events (event_id, entity_type, entity_id, action, actor, metadata, created_at)
        SELECT event_id, entity_type, entity_id, action, actor, metadata, created_at
        FROM financial_events_legacy
      `);
      await database.run('DROP TABLE financial_events_legacy');
      console.log('Self-healed financial_events entity_type constraint for refund disbursement audits.');
    }

    console.log("[Payment Setup] Phase 8 payment systems tables initialized.");

    // ─── Phase 9: Security & Session Management ───
    await database.run(`
      CREATE TABLE IF NOT EXISTS schema_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await database.run(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        ip_address TEXT,
        user_agent TEXT,
        expires_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);

    // Insert v1.0.0 version seed
    await database.run(`
      INSERT OR IGNORE INTO schema_versions (version) VALUES ('v1.0.0')
    `);

  } catch (err) {
    console.error("Error setting up Phase 8 and 9 tables:", err.message);
  }

  return database;
};

const getDb = () => database;

module.exports = { initDb, getDb };
