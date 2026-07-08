PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- Rename old table to backup
ALTER TABLE orders RENAME TO orders_old;

-- Create new orders table with the updated check constraints
CREATE TABLE orders (
  order_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL,
  order_number        TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','shipped','delivered','cancelled','returned')),
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
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Copy all order rows while mapping legacy V1 statuses:
-- confirmed/packed -> processing
-- out_for_delivery -> shipped
INSERT INTO orders (
  order_id, user_id, order_number, status, payment_method, payment_status, 
  subtotal_amount, shipping_amount, tax_amount, total_amount, 
  customer_name, customer_email, customer_phone, address_line_1, address_line_2, 
  city, state, postal_code, country_code, placed_at, updated_at
)
SELECT 
  order_id, user_id, order_number, 
  CASE status 
    WHEN 'confirmed' THEN 'processing' 
    WHEN 'packed' THEN 'processing' 
    WHEN 'out_for_delivery' THEN 'shipped' 
    ELSE status 
  END, 
  payment_method, payment_status, 
  subtotal_amount, shipping_amount, tax_amount, total_amount, 
  customer_name, customer_email, customer_phone, address_line_1, address_line_2, 
  city, state, postal_code, country_code, placed_at, updated_at 
FROM orders_old;

-- Drop backup table
DROP TABLE orders_old;

-- Recreate index points
CREATE INDEX IF NOT EXISTS ix_orders_user_date ON orders(user_id, placed_at);
CREATE INDEX IF NOT EXISTS ix_orders_status_payment ON orders(status, payment_status);

COMMIT;
PRAGMA foreign_keys = ON;
