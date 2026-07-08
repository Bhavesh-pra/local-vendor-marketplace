PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS map_user_supplier (
  user_id INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS map_category (
  legacy_category TEXT PRIMARY KEY,
  category_id INTEGER NOT NULL
);

INSERT INTO users_new (
  user_id, username, email, password_hash, phone,
  address_line_1, role, status, created_at, updated_at
)
SELECT
  u.user_id,
  trim(u.name),
  lower(trim(u.email_id)),
  u.password,
  CAST(u.mobile_number AS TEXT),
  u.address,
  'customer',
  'active',
  datetime('now'),
  datetime('now')
FROM user u
WHERE NOT EXISTS (
  SELECT 1 FROM users_new n WHERE n.user_id = u.user_id
);

INSERT INTO suppliers_new (
  supplier_id, user_id, supplier_name, contact_email, contact_phone,
  address_line_1, supplier_status, created_at, updated_at
)
SELECT DISTINCT
  p.user_id AS supplier_id,
  p.user_id AS user_id,
  'Supplier ' || p.user_id AS supplier_name,
  un.email,
  un.phone,
  un.address_line_1,
  'active',
  datetime('now'),
  datetime('now')
FROM products_table p
JOIN users_new un ON un.user_id = p.user_id
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM suppliers_new s WHERE s.supplier_id = p.user_id
  );

INSERT OR IGNORE INTO map_user_supplier (user_id, supplier_id)
SELECT supplier_id, supplier_id FROM suppliers_new;

UPDATE users_new
SET role = 'supplier',
    updated_at = datetime('now')
WHERE user_id IN (SELECT user_id FROM map_user_supplier);

INSERT INTO categories_new (
  category_name, category_slug, is_active, created_at, updated_at
)
SELECT DISTINCT
  CASE
    WHEN lower(trim(category)) IN ('clothes','furniture','electronics','accessories','other','others')
      THEN CASE
             WHEN lower(trim(category)) IN ('other','others') THEN 'Others'
             ELSE upper(substr(trim(category),1,1)) || lower(substr(trim(category),2))
           END
    ELSE upper(substr(trim(category),1,1)) || lower(substr(trim(category),2))
  END,
  replace(lower(trim(
    CASE
      WHEN lower(trim(category)) IN ('other','others') THEN 'others'
      ELSE category
    END
  )), ' ', '-'),
  1,
  datetime('now'),
  datetime('now')
FROM products_table
WHERE category IS NOT NULL
  AND trim(category) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM categories_new c
    WHERE c.category_slug = replace(lower(trim(
      CASE
        WHEN lower(trim(products_table.category)) IN ('other','others') THEN 'others'
        ELSE products_table.category
      END
    )), ' ', '-')
  );

INSERT OR REPLACE INTO map_category (legacy_category, category_id)
SELECT DISTINCT
  p.category,
  c.category_id
FROM products_table p
JOIN categories_new c
  ON c.category_slug = replace(lower(trim(
    CASE
      WHEN lower(trim(p.category)) IN ('other','others') THEN 'others'
      ELSE p.category
    END
  )), ' ', '-');

INSERT INTO products_new (
  product_id, supplier_id, category_id, product_name, description,
  manufacture_date, cost_price, selling_price, image_url, size_or_quantity,
  product_status, created_at, updated_at
)
SELECT
  p.product_id,
  mus.supplier_id,
  mc.category_id,
  p.product_name,
  p.description,
  p.date_of_manufacture,
  CASE
    WHEN p.original_price IS NULL AND p.discounted_price IS NULL THEN 0
    WHEN p.original_price IS NULL THEN p.discounted_price
    WHEN p.discounted_price IS NULL THEN p.original_price
    WHEN p.original_price <= p.discounted_price THEN p.original_price
    ELSE p.discounted_price
  END,
  CASE
    WHEN p.original_price IS NULL AND p.discounted_price IS NULL THEN 0
    WHEN p.original_price IS NULL THEN p.discounted_price
    WHEN p.discounted_price IS NULL THEN p.original_price
    WHEN p.original_price >= p.discounted_price THEN p.original_price
    ELSE p.discounted_price
  END,
  p.image_url,
  p.size_or_quantity,
  'active',
  datetime('now'),
  datetime('now')
FROM products_table p
JOIN map_user_supplier mus ON mus.user_id = p.user_id
JOIN map_category mc ON mc.legacy_category = p.category
WHERE NOT EXISTS (
  SELECT 1 FROM products_new pn WHERE pn.product_id = p.product_id
);

INSERT INTO inventory_new (
  product_id, available_stock, reserved_stock, reorder_level, updated_at
)
SELECT
  p.product_id,
  10,
  0,
  5,
  datetime('now')
FROM products_table p
WHERE EXISTS (SELECT 1 FROM products_new pn WHERE pn.product_id = p.product_id)
  AND NOT EXISTS (SELECT 1 FROM inventory_new i WHERE i.product_id = p.product_id);

COMMIT;
PRAGMA foreign_keys = ON;
