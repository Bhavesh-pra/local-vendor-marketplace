-- Phase 0 Foundation Refactor Schema Migration
-- Targets SQLite database. Rebuilds inventory, cart_items, and order_items.
-- Introduces product_variants, product_images, inventory_movements, and alerts.

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- ─── 1. CREATE NEW TABLES ──────────────────────────────────────────────────

-- 1.1 Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  variant_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id           INTEGER NOT NULL,
  sku                  TEXT NOT NULL UNIQUE,
  size                 TEXT,
  color                TEXT,
  price_override       NUMERIC CHECK (price_override >= 0),
  cost_override        NUMERIC CHECK (cost_override >= 0),
  is_default           INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_product_variants_product ON product_variants(product_id);

-- 1.2 Product Images Gallery
CREATE TABLE IF NOT EXISTS product_images (
  image_id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id           INTEGER NOT NULL,
  image_url            TEXT NOT NULL,
  is_primary           INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  display_order        INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_product_images_product ON product_images(product_id);

-- 1.3 Inventory Movements log
CREATE TABLE IF NOT EXISTS inventory_movements (
  movement_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id           INTEGER NOT NULL,
  change               INTEGER NOT NULL,
  reason               TEXT NOT NULL CHECK (reason IN ('purchase', 'sale', 'cancellation', 'return', 'manual_adjustment')),
  created_by           TEXT NOT NULL DEFAULT 'system',
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_inventory_movements_variant ON inventory_movements(variant_id);
CREATE INDEX IF NOT EXISTS ix_inventory_movements_reason ON inventory_movements(reason);

-- 1.4 System Alerts
CREATE TABLE IF NOT EXISTS alerts (
  alert_id             INTEGER PRIMARY KEY AUTOINCREMENT,
  type                 TEXT NOT NULL CHECK (type IN ('low_stock', 'out_of_stock', 'dead_stock', 'system')),
  severity             TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  product_id           INTEGER,
  variant_id           INTEGER,
  message              TEXT NOT NULL,
  is_read              INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at          TEXT,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_alerts_read_status ON alerts(is_read);
CREATE INDEX IF NOT EXISTS ix_alerts_type ON alerts(type);
CREATE UNIQUE INDEX IF NOT EXISTS ux_active_alerts_per_variant ON alerts(type, variant_id) WHERE resolved_at IS NULL;

-- 1.5 Redesigned Inventory
CREATE TABLE IF NOT EXISTS inventory_new (
  inventory_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id           INTEGER NOT NULL UNIQUE,
  supplier_id          INTEGER NOT NULL,
  supplier_sku         TEXT,
  available_stock      INTEGER NOT NULL DEFAULT 0 CHECK (available_stock >= 0),
  reserved_stock       INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  reorder_level        INTEGER NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
  purchase_price       NUMERIC NOT NULL CHECK (purchase_price >= 0),
  last_restock_date    TEXT,
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_inventory_reorder ON inventory_new(reorder_level, available_stock);
CREATE INDEX IF NOT EXISTS ix_inventory_supplier ON inventory_new(supplier_id);

-- 1.6 Redesigned Cart Items
CREATE TABLE IF NOT EXISTS cart_items_new (
  cart_item_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id              INTEGER NOT NULL,
  variant_id           INTEGER NOT NULL,
  quantity             INTEGER NOT NULL CHECK (quantity > 0),
  unit_price           NUMERIC NOT NULL CHECK (unit_price >= 0),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cart_id) REFERENCES cart(cart_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (cart_id, variant_id)
);

CREATE INDEX IF NOT EXISTS ix_cart_items_new_cart ON cart_items_new(cart_id);
CREATE INDEX IF NOT EXISTS ix_cart_items_new_variant ON cart_items_new(variant_id);

-- 1.7 Redesigned Order Items
CREATE TABLE IF NOT EXISTS order_items_new (
  order_item_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id             INTEGER NOT NULL,
  variant_id           INTEGER NOT NULL,
  supplier_id          INTEGER NOT NULL,
  quantity             INTEGER NOT NULL CHECK (quantity > 0),
  unit_price           NUMERIC NOT NULL CHECK (unit_price >= 0),
  line_total           NUMERIC NOT NULL CHECK (line_total >= 0),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_order_items_new_order ON order_items_new(order_id);
CREATE INDEX IF NOT EXISTS ix_order_items_new_variant ON order_items_new(variant_id);
CREATE INDEX IF NOT EXISTS ix_order_items_new_supplier ON order_items_new(supplier_id);


-- ─── 2. DATA MIGRATION ──────────────────────────────────────────────────────

-- 2.1 Migrate Image URL to product_images
INSERT INTO product_images (product_id, image_url, is_primary, display_order)
SELECT product_id, image_url, 1, 0 
FROM products 
WHERE image_url IS NOT NULL AND image_url <> '';

-- 2.2 Migrate Products to Product Variants (generates unique clean SKUs)
INSERT INTO product_variants (product_id, sku, size, color, price_override, cost_override, is_default, status)
SELECT 
  p.product_id,
  UPPER(SUBSTR(COALESCE(c.category_name, 'GEN'), 1, 3)) || '-' || 
  COALESCE(UPPER(SUBSTR(p.product_name, 1, 3)), 'DFT') || '-' || 
  COALESCE(UPPER(SUBSTR(p.size_or_quantity, 1, 3)), 'UNI') || '-' || p.product_id,
  p.size_or_quantity,
  'Default',
  p.selling_price,
  p.cost_price,
  1,
  'active'
FROM products p
LEFT JOIN categories c ON p.category_id = c.category_id;

-- 2.3 Migrate Inventory (Join legacy product to new variant)
INSERT INTO inventory_new (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price, last_restock_date)
SELECT 
  pv.variant_id, 
  p.supplier_id,
  i.available_stock, 
  i.reserved_stock, 
  i.reorder_level,
  p.cost_price,
  datetime('now')
FROM inventory i
JOIN product_variants pv ON i.product_id = pv.product_id
JOIN products p ON pv.product_id = p.product_id;

-- 2.4 Migrate Cart Items
INSERT INTO cart_items_new (cart_item_id, cart_id, variant_id, quantity, unit_price, created_at, updated_at)
SELECT ci.cart_item_id, ci.cart_id, pv.variant_id, ci.quantity, ci.unit_price, ci.created_at, ci.updated_at
FROM cart_items ci
JOIN product_variants pv ON ci.product_id = pv.product_id;

-- 2.5 Migrate Order Items
INSERT INTO order_items_new (order_item_id, order_id, variant_id, supplier_id, quantity, unit_price, line_total, created_at)
SELECT oi.order_item_id, oi.order_id, pv.variant_id, oi.supplier_id, oi.quantity, oi.unit_price, oi.line_total, oi.created_at
FROM order_items oi
JOIN product_variants pv ON oi.product_id = pv.product_id;

-- 2.6 Log Initial Inventory Movements for existing stocks
INSERT INTO inventory_movements (variant_id, change, reason, created_by, created_at)
SELECT variant_id, available_stock, 'manual_adjustment', 'migration', datetime('now')
FROM inventory_new;


-- ─── 3. CUTOVER RENAME ──────────────────────────────────────────────────────

ALTER TABLE inventory RENAME TO inventory_legacy;
ALTER TABLE cart_items RENAME TO cart_items_legacy;
ALTER TABLE order_items RENAME TO order_items_legacy;

ALTER TABLE inventory_new RENAME TO inventory;
ALTER TABLE cart_items_new RENAME TO cart_items;
ALTER TABLE order_items_new RENAME TO order_items;

COMMIT;
PRAGMA foreign_keys = ON;
