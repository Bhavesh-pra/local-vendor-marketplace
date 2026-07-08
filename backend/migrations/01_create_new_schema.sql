PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS users_new (
  user_id            INTEGER PRIMARY KEY,
  username           TEXT NOT NULL,
  email              TEXT NOT NULL,
  password_hash      TEXT NOT NULL,
  phone              TEXT,
  address_line_1     TEXT,
  address_line_2     TEXT,
  city               TEXT,
  state              TEXT,
  postal_code        TEXT,
  country_code       TEXT NOT NULL DEFAULT 'IN',
  role               TEXT NOT NULL DEFAULT 'customer'
                     CHECK (role IN ('customer','supplier','admin')),
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','inactive','suspended')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers_new (
  supplier_id        INTEGER PRIMARY KEY,
  user_id            INTEGER UNIQUE,
  supplier_name      TEXT NOT NULL,
  contact_email      TEXT,
  contact_phone      TEXT,
  address_line_1     TEXT,
  address_line_2     TEXT,
  city               TEXT,
  state              TEXT,
  postal_code        TEXT,
  country_code       TEXT NOT NULL DEFAULT 'IN',
  supplier_status    TEXT NOT NULL DEFAULT 'active'
                     CHECK (supplier_status IN ('active','inactive')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users_new(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS categories_new (
  category_id        INTEGER PRIMARY KEY,
  category_name      TEXT NOT NULL,
  category_slug      TEXT NOT NULL,
  is_active          INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products_new (
  product_id         INTEGER PRIMARY KEY,
  supplier_id        INTEGER NOT NULL,
  category_id        INTEGER NOT NULL,
  product_name       TEXT NOT NULL,
  description        TEXT NOT NULL,
  sku                TEXT,
  manufacture_date   TEXT,
  cost_price         NUMERIC NOT NULL CHECK (cost_price >= 0),
  selling_price      NUMERIC NOT NULL CHECK (selling_price >= 0 AND selling_price >= cost_price),
  image_url          TEXT,
  size_or_quantity   TEXT,
  product_status     TEXT NOT NULL DEFAULT 'active'
                     CHECK (product_status IN ('draft','active','inactive','archived')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers_new(supplier_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES categories_new(category_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS inventory_new (
  inventory_id       INTEGER PRIMARY KEY,
  product_id         INTEGER NOT NULL UNIQUE,
  available_stock    INTEGER NOT NULL DEFAULT 0 CHECK (available_stock >= 0),
  reserved_stock     INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  reorder_level      INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products_new(product_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_new (
  cart_id            INTEGER PRIMARY KEY,
  user_id            INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','converted','abandoned')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users_new(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items_new (
  cart_item_id       INTEGER PRIMARY KEY,
  cart_id            INTEGER NOT NULL,
  product_id         INTEGER NOT NULL,
  quantity           INTEGER NOT NULL CHECK (quantity > 0),
  unit_price         NUMERIC NOT NULL CHECK (unit_price >= 0),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cart_id) REFERENCES cart_new(cart_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products_new(product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders_new (
  order_id            INTEGER PRIMARY KEY,
  user_id             INTEGER NOT NULL,
  order_number        TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','packed','out_for_delivery','delivered','cancelled')),
  payment_method      TEXT NOT NULL
                      CHECK (payment_method IN ('COD','UPI','CARD')),
  payment_status      TEXT NOT NULL DEFAULT 'pending'
                      CHECK (payment_status IN ('pending','paid','failed')),
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
  FOREIGN KEY (user_id) REFERENCES users_new(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS order_items_new (
  order_item_id       INTEGER PRIMARY KEY,
  order_id            INTEGER NOT NULL,
  product_id          INTEGER NOT NULL,
  supplier_id         INTEGER NOT NULL,
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  unit_price          NUMERIC NOT NULL CHECK (unit_price >= 0),
  line_total          NUMERIC NOT NULL CHECK (line_total >= 0),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders_new(order_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products_new(product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers_new(supplier_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS reviews_new (
  review_id           INTEGER PRIMARY KEY,
  product_id          INTEGER NOT NULL,
  user_id             INTEGER NOT NULL,
  rating              INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment             TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products_new(product_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users_new(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE (product_id, user_id)
);

COMMIT;
PRAGMA foreign_keys = ON;
