-- PURPOSE:
-- Read-only preflight checks. Run on a COPY of the SQLite DB.
-- If missing_table or duplicate email queries return rows, stop before migration.

SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name IN (
    'user',
    'products_table',
    'review_table',
    'rating_table',
    'cart_table',
    'cart_item_table'
  )
ORDER BY name;

WITH expected(name) AS (
  VALUES
    ('user'),
    ('products_table'),
    ('review_table'),
    ('rating_table'),
    ('cart_table'),
    ('cart_item_table')
)
SELECT e.name AS missing_table
FROM expected e
LEFT JOIN sqlite_master s
  ON s.type = 'table'
 AND s.name = e.name
WHERE s.name IS NULL;

SELECT LOWER(email_id) AS normalized_email, COUNT(*) AS duplicate_count
FROM user
GROUP BY LOWER(email_id)
HAVING COUNT(*) > 1;

SELECT 'user' AS table_name, COUNT(*) AS row_count FROM user
UNION ALL SELECT 'products_table', COUNT(*) FROM products_table
UNION ALL SELECT 'review_table', COUNT(*) FROM review_table
UNION ALL SELECT 'rating_table', COUNT(*) FROM rating_table
UNION ALL SELECT 'cart_table', COUNT(*) FROM cart_table
UNION ALL SELECT 'cart_item_table', COUNT(*) FROM cart_item_table;
