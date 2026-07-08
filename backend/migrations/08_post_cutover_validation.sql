PRAGMA integrity_check;
PRAGMA foreign_key_check;

SELECT COUNT(*) AS users_count FROM users;
SELECT COUNT(*) AS suppliers_count FROM suppliers;
SELECT COUNT(*) AS categories_count FROM categories;
SELECT COUNT(*) AS products_count FROM products;
SELECT COUNT(*) AS inventory_count FROM inventory;
SELECT COUNT(*) AS cart_count FROM cart;
SELECT COUNT(*) AS cart_items_count FROM cart_items;
SELECT COUNT(*) AS orders_count FROM orders;
SELECT COUNT(*) AS order_items_count FROM order_items;
SELECT COUNT(*) AS reviews_count FROM reviews;

SELECT COUNT(*) AS bad_price_rows
FROM products
WHERE selling_price < cost_price;

SELECT COUNT(*) AS bad_inventory_rows
FROM inventory
WHERE available_stock < 0 OR reserved_stock < 0 OR reorder_level < 0;

SELECT COUNT(*) AS bad_rating_rows
FROM reviews
WHERE rating NOT BETWEEN 1 AND 5;

SELECT COUNT(*) AS products_without_inventory
FROM products p
LEFT JOIN inventory i ON i.product_id = p.product_id
WHERE i.product_id IS NULL;
