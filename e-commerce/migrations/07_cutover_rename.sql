PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

ALTER TABLE user RENAME TO user_legacy;
ALTER TABLE products_table RENAME TO products_table_legacy;
ALTER TABLE review_table RENAME TO review_table_legacy;
ALTER TABLE rating_table RENAME TO rating_table_legacy;
ALTER TABLE cart_table RENAME TO cart_table_legacy;
ALTER TABLE cart_item_table RENAME TO cart_item_table_legacy;

ALTER TABLE users_new RENAME TO users;
ALTER TABLE suppliers_new RENAME TO suppliers;
ALTER TABLE categories_new RENAME TO categories;
ALTER TABLE products_new RENAME TO products;
ALTER TABLE inventory_new RENAME TO inventory;
ALTER TABLE cart_new RENAME TO cart;
ALTER TABLE cart_items_new RENAME TO cart_items;
ALTER TABLE orders_new RENAME TO orders;
ALTER TABLE order_items_new RENAME TO order_items;
ALTER TABLE reviews_new RENAME TO reviews;

COMMIT;
PRAGMA foreign_keys = ON;
