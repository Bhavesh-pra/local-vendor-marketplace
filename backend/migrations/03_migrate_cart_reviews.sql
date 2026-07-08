PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

INSERT INTO cart_new (cart_id, user_id, status, created_at, updated_at)
SELECT
  c.cart_id,
  c.user_id,
  'active',
  datetime('now'),
  datetime('now')
FROM cart_table c
WHERE EXISTS (SELECT 1 FROM users_new u WHERE u.user_id = c.user_id)
  AND NOT EXISTS (SELECT 1 FROM cart_new cn WHERE cn.cart_id = c.cart_id);

INSERT INTO cart_items_new (
  cart_item_id, cart_id, product_id, quantity, unit_price, created_at, updated_at
)
SELECT
  ci.cart_item_id,
  ci.cart_id,
  ci.product_id,
  CASE WHEN ci.quantity <= 0 THEN 1 ELSE ci.quantity END,
  pn.selling_price,
  datetime('now'),
  datetime('now')
FROM cart_item_table ci
JOIN products_new pn ON pn.product_id = ci.product_id
JOIN cart_new cn ON cn.cart_id = ci.cart_id
WHERE NOT EXISTS (
  SELECT 1 FROM cart_items_new cin WHERE cin.cart_item_id = ci.cart_item_id
);

INSERT INTO users_new (
  user_id, username, email, password_hash, role, status, created_at, updated_at
)
SELECT
  -1,
  'Anonymous User',
  'anonymous@local.invalid',
  'migrated_no_login',
  'customer',
  'active',
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM users_new WHERE user_id = -1);

DROP TABLE IF EXISTS tmp_rating_pick;
CREATE TEMP TABLE tmp_rating_pick AS
SELECT r.product_id, r.rating
FROM rating_table r
JOIN (
  SELECT product_id, MAX(rating_id) AS max_rating_id
  FROM rating_table
  WHERE product_id IS NOT NULL
  GROUP BY product_id
) x ON x.product_id = r.product_id AND x.max_rating_id = r.rating_id;

DROP TABLE IF EXISTS tmp_review_dedup;
CREATE TEMP TABLE tmp_review_dedup AS
SELECT rv.*
FROM review_table rv
JOIN (
  SELECT product_id, user_id, MAX(review_date) AS max_review_date
  FROM review_table
  GROUP BY product_id, user_id
) d ON d.product_id = rv.product_id
   AND d.user_id = rv.user_id
   AND d.max_review_date = rv.review_date;

INSERT INTO reviews_new (
  review_id, product_id, user_id, rating, comment, created_at, updated_at
)
SELECT
  tr.review_id,
  tr.product_id,
  tr.user_id,
  COALESCE(trp.rating, 5),
  tr.comment,
  datetime(CASE WHEN tr.review_date > 0 THEN tr.review_date/1000 ELSE strftime('%s','now') END, 'unixepoch'),
  datetime('now')
FROM tmp_review_dedup tr
LEFT JOIN tmp_rating_pick trp ON trp.product_id = tr.product_id
WHERE EXISTS (SELECT 1 FROM products_new p WHERE p.product_id = tr.product_id)
  AND EXISTS (SELECT 1 FROM users_new u WHERE u.user_id = tr.user_id)
  AND NOT EXISTS (
    SELECT 1 FROM reviews_new rn
    WHERE rn.product_id = tr.product_id AND rn.user_id = tr.user_id
  );

INSERT INTO reviews_new (
  product_id, user_id, rating, comment, created_at, updated_at
)
SELECT
  rp.product_id,
  -1,
  rp.rating,
  'Rating imported from legacy system',
  datetime('now'),
  datetime('now')
FROM tmp_rating_pick rp
WHERE EXISTS (SELECT 1 FROM products_new p WHERE p.product_id = rp.product_id)
  AND NOT EXISTS (
    SELECT 1 FROM reviews_new r WHERE r.product_id = rp.product_id
  );

COMMIT;
PRAGMA foreign_keys = ON;
