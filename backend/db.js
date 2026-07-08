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

  return database;
};

const getDb = () => database;

module.exports = { initDb, getDb };
