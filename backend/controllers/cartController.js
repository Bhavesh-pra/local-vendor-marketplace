const createCartController = (database) => ({
  createCart: async (req, res) => {
    try {
      const existing = await database.get(
        `SELECT cart_id, user_id FROM cart WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        [req.userId]
      );
      if (existing) {
        return res.json({ cart_id: existing.cart_id, user_id: req.userId });
      }

      const result = await database.run(
        `INSERT INTO cart (user_id, status) VALUES (?, 'active')`,
        [req.userId]
      );
      res.status(201).json({ cart_id: result.lastID, user_id: req.userId });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getCarts: async (req, res) => {
    try {
      const carts = await database.all(
        `SELECT * FROM cart WHERE user_id = ? ORDER BY created_at DESC`,
        [req.userId]
      );
      res.json(carts);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  addCartItem: async (req, res) => {
    const { cart_id, product_id, variant_id: bodyVariantId, quantity } = req.body;
    if (!cart_id || (!product_id && !bodyVariantId) || quantity == null) {
      res.status(400).json({ message: 'Missing cart_id, product_id/variant_id, or quantity' });
      return;
    }
    const parsedQty = Number(quantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      res.status(400).json({ message: 'Quantity must be a positive integer' });
      return;
    }
    try {
      const cart = await database.get(
        'SELECT user_id, status FROM cart WHERE cart_id = ?', [cart_id]
      );
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }
      if (cart.user_id !== req.userId) {
        return res.status(403).json({ message: 'Unauthorized access to cart' });
      }
      if (cart.status !== 'active') {
        return res.status(409).json({ message: 'Cart is not active' });
      }

      // Resolve variant_id (backward compatibility fallback)
      let variant_id = bodyVariantId;
      if (!variant_id) {
        const defaultVar = await database.get(
          'SELECT variant_id FROM product_variants WHERE product_id = ? AND is_default = 1',
          [product_id]
        );
        if (!defaultVar) {
          return res.status(400).json({ message: 'Default variant not found for this product' });
        }
        variant_id = defaultVar.variant_id;
      }

      const variant = await database.get(
        `SELECT pv.product_id, COALESCE(pv.price_override, p.selling_price) AS unit_price 
         FROM product_variants pv 
         JOIN products p ON pv.product_id = p.product_id 
         WHERE pv.variant_id = ? AND pv.status = 'active'`,
        [variant_id]
      );
      if (!variant) {
        return res.status(400).json({ message: 'Active product variant not found' });
      }
      const unit_price = variant.unit_price;

      const existingItem = await database.get(
        'SELECT cart_item_id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?',
        [cart_id, variant_id]
      );

      if (existingItem) {
        const newQty = existingItem.quantity + parsedQty;
        await database.run(
          `UPDATE cart_items SET quantity = ?, unit_price = ?, updated_at = datetime('now') WHERE cart_item_id = ?`,
          [newQty, unit_price, existingItem.cart_item_id]
        );
        res.json({ cart_item_id: existingItem.cart_item_id, cart_id, product_id: variant.product_id, variant_id, quantity: newQty });
      } else {
        const result = await database.run(
          `INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
          [cart_id, variant_id, parsedQty, unit_price]
        );
        res.json({ cart_item_id: result.lastID, cart_id, product_id: variant.product_id, variant_id, quantity: parsedQty });
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getCartItems: async (req, res) => {
    const cart_id = req.query.cart_id;
    let targetCartId = cart_id;
    
    if (!targetCartId) {
      const activeCart = await database.get(
        "SELECT cart_id FROM cart WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        [req.userId]
      );
      if (!activeCart) {
        return res.json([]);
      }
      targetCartId = activeCart.cart_id;
    } else {
      try {
        const cart = await database.get('SELECT user_id FROM cart WHERE cart_id = ?', [targetCartId]);
        if (!cart) {
          return res.status(404).json({ message: 'Cart not found' });
        }
        if (cart.user_id !== req.userId) {
          return res.status(403).json({ message: 'Unauthorized access to cart' });
        }
      } catch (err) {
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }
    }

    try {
      const items = await database.all(`
        SELECT 
          ci.cart_item_id,
          ci.cart_id,
          ci.variant_id,
          ci.quantity,
          ci.unit_price,
          ci.created_at,
          ci.updated_at,
          pv.product_id,
          pv.size,
          pv.color,
          pv.sku,
          p.product_name,
          p.brand,
          p.category_id,
          COALESCE(pv.mrp_override, p.mrp, ci.unit_price) AS mrp,
          pi.image_url,
          IFNULL(i.available_stock, 0) AS available_stock,
          IFNULL(ps.free_shipping, 0) AS free_shipping
        FROM cart_items ci
        JOIN product_variants pv ON ci.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN product_images pi ON p.product_id = pi.product_id AND pi.is_primary = 1
        LEFT JOIN inventory i ON pv.variant_id = i.variant_id
        LEFT JOIN product_shipping ps ON p.product_id = ps.product_id
        WHERE ci.cart_id = ?
      `, [targetCartId]);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getCartItemsById: async (req, res) => {
    const { cart_id } = req.params;
    try {
      const cart = await database.get('SELECT user_id FROM cart WHERE cart_id = ?', [cart_id]);
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }
      if (cart.user_id !== req.userId) {
        return res.status(403).json({ message: 'Unauthorized access to cart' });
      }
      const items = await database.all(`
        SELECT 
          ci.cart_item_id,
          ci.cart_id,
          ci.variant_id,
          ci.quantity,
          ci.unit_price,
          ci.created_at,
          ci.updated_at,
          pv.product_id,
          pv.size,
          pv.color,
          pv.sku,
          p.product_name,
          p.brand,
          p.category_id,
          COALESCE(pv.mrp_override, p.mrp, ci.unit_price) AS mrp,
          pi.image_url,
          IFNULL(i.available_stock, 0) AS available_stock,
          IFNULL(ps.free_shipping, 0) AS free_shipping
        FROM cart_items ci
        JOIN product_variants pv ON ci.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN product_images pi ON p.product_id = pi.product_id AND pi.is_primary = 1
        LEFT JOIN inventory i ON pv.variant_id = i.variant_id
        LEFT JOIN product_shipping ps ON p.product_id = ps.product_id
        WHERE ci.cart_id = ?
      `, [cart_id]);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  updateCartItem: async (req, res) => {
    const { cart_item_id } = req.params;
    const { quantity } = req.body;
    if (quantity == null) {
      return res.status(400).json({ message: 'Missing quantity' });
    }
    const parsedQty = Number(quantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({ message: 'Quantity must be a positive integer' });
    }
    try {
      const item = await database.get(
        `SELECT ci.*, c.user_id, c.status AS cart_status FROM cart_items ci JOIN cart c ON ci.cart_id = c.cart_id WHERE ci.cart_item_id = ?`,
        [cart_item_id]
      );
      if (!item) {
        return res.status(404).json({ message: 'Cart item not found' });
      }
      if (item.user_id !== req.userId) {
        return res.status(403).json({ message: 'Unauthorized access to cart item' });
      }
      if (item.cart_status !== 'active') {
        return res.status(409).json({ message: 'Cart is not active' });
      }

      await database.run(
        `UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE cart_item_id = ?`,
        [parsedQty, cart_item_id]
      );
      res.json({ cart_item_id, quantity: parsedQty });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  deleteCartItem: async (req, res) => {
    const { cart_item_id } = req.params;
    try {
      const item = await database.get(
        `SELECT ci.*, c.user_id, c.status AS cart_status FROM cart_items ci JOIN cart c ON ci.cart_id = c.cart_id WHERE ci.cart_item_id = ?`,
        [cart_item_id]
      );
      if (!item) {
        return res.status(404).json({ message: 'Cart item not found' });
      }
      if (item.user_id !== req.userId) {
        return res.status(403).json({ message: 'Unauthorized access to cart item' });
      }
      if (item.cart_status !== 'active') {
        return res.status(409).json({ message: 'Cart is not active' });
      }

      await database.run('DELETE FROM cart_items WHERE cart_item_id = ?', [cart_item_id]);
      res.json({ message: 'Cart item removed successfully', cart_item_id });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getSavedItems: async (req, res) => {
    try {
      const items = await database.all(`
        SELECT 
          si.id,
          si.user_id,
          si.product_id,
          si.variant_id,
          si.created_at,
          pv.size,
          pv.color,
          pv.sku,
          COALESCE(pv.price_override, p.selling_price) AS unit_price,
          COALESCE(pv.mrp_override, p.mrp) AS mrp,
          p.product_name,
          p.brand,
          p.category_id,
          pi.image_url,
          IFNULL(i.available_stock, 0) AS available_stock,
          IFNULL(ps.free_shipping, 0) AS free_shipping
        FROM saved_items si
        JOIN product_variants pv ON si.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN product_images pi ON p.product_id = pi.product_id AND pi.is_primary = 1
        LEFT JOIN inventory i ON pv.variant_id = i.variant_id
        LEFT JOIN product_shipping ps ON p.product_id = ps.product_id
        WHERE si.user_id = ?
        ORDER BY si.created_at DESC
        LIMIT 20
      `, [req.userId]);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  saveItem: async (req, res) => {
    const { product_id, variant_id, cart_item_id } = req.body;
    if (!product_id || !variant_id) {
      return res.status(400).json({ message: 'Missing product_id or variant_id' });
    }
    try {
      await database.run('BEGIN TRANSACTION');
      
      if (cart_item_id) {
        // Verify cart item belongs to user
        const cartItem = await database.get(
          `SELECT ci.cart_item_id, c.user_id 
           FROM cart_items ci 
           JOIN cart c ON ci.cart_id = c.cart_id 
           WHERE ci.cart_item_id = ?`,
          [cart_item_id]
        );
        
        if (!cartItem) {
          await database.run('ROLLBACK');
          return res.status(404).json({ message: 'Cart item not found' });
        }
        
        if (cartItem.user_id !== req.userId) {
          await database.run('ROLLBACK');
          return res.status(403).json({ message: 'Unauthorized access to cart item' });
        }
        
        await database.run('DELETE FROM cart_items WHERE cart_item_id = ?', [cart_item_id]);
      }

      // Enforce limit of 20 items in Saved for Later
      const countRow = await database.get('SELECT COUNT(*) AS count FROM saved_items WHERE user_id = ?', [req.userId]);
      if (countRow && countRow.count >= 20) {
        await database.run('ROLLBACK');
        return res.status(400).json({ message: 'Saved items list is full. Maximum limit is 20 items.' });
      }

      await database.run(
        `INSERT OR IGNORE INTO saved_items (user_id, product_id, variant_id) VALUES (?, ?, ?)`,
        [req.userId, product_id, variant_id]
      );
      
      await database.run('COMMIT');
      res.status(201).json({ message: 'Item saved for later successfully' });
    } catch (err) {
      try {
        await database.run('ROLLBACK');
      } catch (e) {}
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  deleteSavedItem: async (req, res) => {
    const { id } = req.params;
    try {
      const item = await database.get('SELECT user_id FROM saved_items WHERE id = ?', [id]);
      if (!item) {
        return res.status(404).json({ message: 'Saved item not found' });
      }
      if (item.user_id !== req.userId) {
        return res.status(403).json({ message: 'Unauthorized access to saved item' });
      }
      await database.run('DELETE FROM saved_items WHERE id = ?', [id]);
      res.json({ message: 'Saved item removed successfully', id });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  moveToCart: async (req, res) => {
    const { id } = req.params;
    try {
      const savedItem = await database.get('SELECT * FROM saved_items WHERE id = ?', [id]);
      if (!savedItem) {
        return res.status(404).json({ message: 'Saved item not found' });
      }
      if (savedItem.user_id !== req.userId) {
        return res.status(403).json({ message: 'Unauthorized access to saved item' });
      }

      await database.run('BEGIN TRANSACTION');

      // 1. Get or create active cart
      let activeCart = await database.get(
        `SELECT cart_id FROM cart WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        [req.userId]
      );
      
      let cartId;
      if (!activeCart) {
        const result = await database.run(
          `INSERT INTO cart (user_id, status) VALUES (?, 'active')`,
          [req.userId]
        );
        cartId = result.lastID;
      } else {
        cartId = activeCart.cart_id;
      }

      // 2. Check if variant already exists in cart
      const existingItem = await database.get(
        'SELECT cart_item_id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?',
        [cartId, savedItem.variant_id]
      );

      // Get unit price
      const variant = await database.get(
        `SELECT COALESCE(pv.price_override, p.selling_price) AS unit_price 
         FROM product_variants pv 
         JOIN products p ON pv.product_id = p.product_id 
         WHERE pv.variant_id = ?`,
        [savedItem.variant_id]
      );

      if (!variant) {
        await database.run('ROLLBACK');
        return res.status(400).json({ message: 'Product variant no longer exists' });
      }

      if (existingItem) {
        // Increment quantity
        await database.run(
          `UPDATE cart_items SET quantity = quantity + 1, updated_at = datetime('now') WHERE cart_item_id = ?`,
          [existingItem.cart_item_id]
        );
      } else {
        // Insert new item
        await database.run(
          `INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price) VALUES (?, ?, 1, ?)`,
          [cartId, savedItem.variant_id, variant.unit_price]
        );
      }

      // 3. Delete from saved_items
      await database.run('DELETE FROM saved_items WHERE id = ?', [id]);

      await database.run('COMMIT');
      res.json({ message: 'Item moved to cart successfully', id });
    } catch (err) {
      try {
        await database.run('ROLLBACK');
      } catch (e) {}
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },
});

module.exports = { createCartController };
