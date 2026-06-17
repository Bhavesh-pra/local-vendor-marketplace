SELECT 'legacy_user' AS table_name, COUNT(*) AS cnt FROM user
UNION ALL SELECT 'legacy_products_table', COUNT(*) FROM products_table
UNION ALL SELECT 'legacy_review_table', COUNT(*) FROM review_table
UNION ALL SELECT 'legacy_rating_table', COUNT(*) FROM rating_table
UNION ALL SELECT 'legacy_cart_table', COUNT(*) FROM cart_table
UNION ALL SELECT 'legacy_cart_item_table', COUNT(*) FROM cart_item_table;

SELECT 'users_new' AS table_name, COUNT(*) AS cnt FROM users_new
UNION ALL SELECT 'suppliers_new', COUNT(*) FROM suppliers_new
UNION ALL SELECT 'categories_new', COUNT(*) FROM categories_new
UNION ALL SELECT 'products_new', COUNT(*) FROM products_new
UNION ALL SELECT 'inventory_new', COUNT(*) FROM inventory_new
UNION ALL SELECT 'cart_new', COUNT(*) FROM cart_new
UNION ALL SELECT 'cart_items_new', COUNT(*) FROM cart_items_new
UNION ALL SELECT 'orders_new', COUNT(*) FROM orders_new
UNION ALL SELECT 'order_items_new', COUNT(*) FROM order_items_new
UNION ALL SELECT 'reviews_new', COUNT(*) FROM reviews_new;

SELECT p.product_id
FROM products_new p
LEFT JOIN suppliers_new s ON s.supplier_id = p.supplier_id
WHERE s.supplier_id IS NULL;

SELECT p.product_id
FROM products_new p
LEFT JOIN categories_new c ON c.category_id = p.category_id
WHERE c.category_id IS NULL;

SELECT i.inventory_id
FROM inventory_new i
LEFT JOIN products_new p ON p.product_id = i.product_id
WHERE p.product_id IS NULL;

SELECT c.cart_id
FROM cart_new c
LEFT JOIN users_new u ON u.user_id = c.user_id
WHERE u.user_id IS NULL;

SELECT ci.cart_item_id
FROM cart_items_new ci
LEFT JOIN cart_new c ON c.cart_id = ci.cart_id
LEFT JOIN products_new p ON p.product_id = ci.product_id
WHERE c.cart_id IS NULL OR p.product_id IS NULL;

SELECT r.review_id
FROM reviews_new r
LEFT JOIN users_new u ON u.user_id = r.user_id
LEFT JOIN products_new p ON p.product_id = r.product_id
WHERE u.user_id IS NULL OR p.product_id IS NULL;

SELECT * FROM products_new WHERE cost_price < 0 OR selling_price < 0 OR selling_price < cost_price;
SELECT * FROM inventory_new WHERE available_stock < 0 OR reserved_stock < 0 OR reorder_level < 0;
SELECT * FROM cart_items_new WHERE quantity <= 0 OR unit_price < 0;
SELECT * FROM reviews_new WHERE rating < 1 OR rating > 5;

SELECT product_id, user_id, COUNT(*) AS c
FROM reviews_new
GROUP BY product_id, user_id
HAVING COUNT(*) > 1;

SELECT COUNT(*) AS migrated_rating_only_rows
FROM reviews_new
WHERE user_id = -1 AND comment = 'Rating imported from legacy system';

SELECT
  (SELECT COUNT(*) FROM products_table) AS legacy_products,
  (SELECT COUNT(*) FROM products_new) AS new_products;

SELECT COUNT(*) AS products_without_inventory
FROM products_new p
LEFT JOIN inventory_new i ON i.product_id = p.product_id
WHERE i.product_id IS NULL;
