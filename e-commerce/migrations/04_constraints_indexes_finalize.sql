PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_new_email ON users_new(email);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_new_username ON users_new(username);
CREATE INDEX IF NOT EXISTS ix_users_new_role_status ON users_new(role, status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_suppliers_new_name ON suppliers_new(supplier_name);
CREATE INDEX IF NOT EXISTS ix_suppliers_new_status ON suppliers_new(supplier_status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_new_name ON categories_new(category_name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_new_slug ON categories_new(category_slug);

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_new_sku ON products_new(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_products_new_supplier ON products_new(supplier_id);
CREATE INDEX IF NOT EXISTS ix_products_new_category ON products_new(category_id);
CREATE INDEX IF NOT EXISTS ix_products_new_status ON products_new(product_status);
CREATE INDEX IF NOT EXISTS ix_products_new_name ON products_new(product_name);

CREATE INDEX IF NOT EXISTS ix_inventory_new_reorder ON inventory_new(reorder_level, available_stock);

CREATE INDEX IF NOT EXISTS ix_cart_new_user_status ON cart_new(user_id, status);
CREATE INDEX IF NOT EXISTS ix_cart_items_new_cart ON cart_items_new(cart_id);
CREATE INDEX IF NOT EXISTS ix_cart_items_new_product ON cart_items_new(product_id);

CREATE INDEX IF NOT EXISTS ix_orders_new_user_date ON orders_new(user_id, placed_at);
CREATE INDEX IF NOT EXISTS ix_orders_new_status_payment ON orders_new(status, payment_status);
CREATE INDEX IF NOT EXISTS ix_order_items_new_order ON order_items_new(order_id);
CREATE INDEX IF NOT EXISTS ix_order_items_new_product ON order_items_new(product_id);
CREATE INDEX IF NOT EXISTS ix_order_items_new_supplier ON order_items_new(supplier_id);

CREATE INDEX IF NOT EXISTS ix_reviews_new_product_date ON reviews_new(product_id, created_at);
CREATE INDEX IF NOT EXISTS ix_reviews_new_user ON reviews_new(user_id);

COMMIT;
PRAGMA foreign_keys = ON;
