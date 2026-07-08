SELECT 'user' AS table_name, COUNT(*) AS row_count FROM user
UNION ALL SELECT 'products_table', COUNT(*) FROM products_table
UNION ALL SELECT 'review_table', COUNT(*) FROM review_table
UNION ALL SELECT 'rating_table', COUNT(*) FROM rating_table
UNION ALL SELECT 'cart_table', COUNT(*) FROM cart_table
UNION ALL SELECT 'cart_item_table', COUNT(*) FROM cart_item_table;
