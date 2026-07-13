const path = require('path');
const {open} = require('sqlite');
const sqlite3 = require('sqlite3');

let database = null;

const initDb = async () => {
  const dbPath = path.join(__dirname, 'ecommerce.sqlite');
  database = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

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

  return database;
};

const getDb = () => database;

module.exports = { initDb, getDb };
