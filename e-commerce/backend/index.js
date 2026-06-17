const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors');
const app = express()
app.use(cors());
app.use(express.json())

const dbPath = path.join(__dirname, 'ecommerce.sqlite')
let database = null

require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});


const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

// API 1
//SECTION 1:
app.post('/register/', async (request, response) => {
  const {name, username, password, email, emailId} = request.body
  const normalizedEmail = (email || emailId || '').trim().toLowerCase()
  const normalizedUsername = (username || name || '').trim()

  if (!normalizedUsername || !normalizedEmail || !password) {
    response.status(400)
    response.send('Username, email, and password are required')
    return
  }

  const dbUser = await database.get(
    'SELECT user_id FROM users WHERE lower(email) = ?',
    [normalizedEmail],
  )

  if (dbUser !== undefined) {
    response.status(400)
    response.send('Email already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const addUserQuery = `
        INSERT INTO 
          users (username, email, password_hash, role, status)
        VALUES (?, ?, ?, 'customer', 'active') 
      `
      await database.run(addUserQuery, [
        normalizedUsername,
        normalizedEmail,
        hashedPassword,
      ])
      response.send('User created successfully')
    }
  }
})

//API 2
//SECTION 2:
app.post('/login/', async (request, response) => {
  const { email, emailId, password } = request.body;
  const normalizedEmail = (email || emailId || '').trim().toLowerCase();

  if (!normalizedEmail || !password) {
    response.status(400).send('Email and password are required');
    return;
  }

  const dbUser = await database.get(
    `SELECT user_id, username, email, password_hash, role, status
     FROM users
     WHERE lower(email) = ?`,
    [normalizedEmail]
  );

  if (dbUser === undefined) {
    response.status(400).send('Invalid user');
  } else if (dbUser.status !== 'active') {
    response.status(403).send('User account is inactive');
  } else {
    const passwordIsMatched = await bcrypt.compare(password, dbUser.password_hash);
    if (passwordIsMatched === true) {
      const payload = {
        userId: dbUser.user_id,
        username: dbUser.username,
        role: dbUser.role,
      };
      const jwtToken = jwt.sign(payload, 'HELLO_WORLD');
      response.send({
        jwtToken,
        userId: dbUser.user_id,
        username: dbUser.username,
        role: dbUser.role,
      });
    } else {
      response.status(400).send('Invalid password');
    }
  }
});


//SECTION jwt Authentication
const authenticateHeader = async (request, response, next) => {
  const authHeader = request.headers['authorization']
  let jwtToken

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (authHeader === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'HELLO_WORLD', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.userId = payload.userId
        request.username = payload.username
        request.role = payload.role
        request.name = payload.username
        next()
      }
    })
  }
}

// Helper to send order email
const sendOrderEmail = (orderNumber, name, email, address, paymentMethod, items, total) => {
  const itemsText = items
    .map(item => `Product ID: ${item.product_id} - Qty: ${item.quantity} - Price: ₹${item.unit_price}`)
    .join('\n');

  const mailText = `
Order Details:
Order Number: ${orderNumber}
Name: ${name}
Email: ${email}
Address: ${address}
Payment Method: ${paymentMethod}

Purchased Items:
${itemsText}

Total Amount: ₹${total.toFixed(2)}
  `;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.MAIL_RECEIVER || email,
    subject: `New Order Placed - ${orderNumber}`,
    text: mailText,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending order email:', err);
    } else {
      console.log('Order email sent successfully:', info.response);
    }
  });
};

// API to add a product (Only supplier or admin)
app.post('/products/', authenticateHeader, async (request, response) => {
  const {
    product_name,
    category,
    description,
    date_of_manufacture,
    selling_price,
    cost_price,
    image_url,
    size_or_quantity,
    supplier_id: bodySupplierId,
  } = request.body;

  if (request.role !== 'supplier' && request.role !== 'admin') {
    return response.status(403).send('Only suppliers or admins may create products');
  }

  let supplier_id = null;
  const supplierRow = await database.get('SELECT supplier_id FROM suppliers WHERE user_id = ?', [request.userId]);
  if (supplierRow) {
    supplier_id = supplierRow.supplier_id;
  } else if (request.role === 'admin') {
    if (!bodySupplierId) {
      return response.status(400).send('Admin must provide a supplier_id in the request body');
    }
    const validSupplier = await database.get('SELECT supplier_id FROM suppliers WHERE supplier_id = ?', [bodySupplierId]);
    if (!validSupplier) {
      return response.status(400).send('Invalid supplier_id');
    }
    supplier_id = bodySupplierId;
  } else {
    return response.status(400).send('Supplier record not found for this user');
  }

  // Resolve category name to category_id
  let catRow = await database.get(
    'SELECT category_id FROM categories WHERE lower(category_name) = ? OR category_id = ?',
    [String(category || 'others').trim().toLowerCase(), Number(category) || 0]
  );
  let category_id = catRow ? catRow.category_id : 5; // default to 'Others'

  const final_selling_price = parseFloat(selling_price || 0);
  const final_cost_price = parseFloat(cost_price || final_selling_price);

  if (final_selling_price < 0 || final_cost_price < 0) {
    return response.status(400).send('Prices must be non-negative');
  }
  if (final_selling_price < final_cost_price) {
    return response.status(400).send('selling_price must be >= cost_price');
  }

  if (
    !product_name ||
    !description ||
    !image_url
  ) {
    return response.status(400).send('Product name, description, and image URL are required');
  }

  try {
    const query = `
      INSERT INTO products
        (supplier_id, category_id, product_name, description, manufacture_date, cost_price, selling_price, image_url, size_or_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await database.run(query, [
      supplier_id,
      category_id,
      product_name,
      description,
      date_of_manufacture || null,
      final_cost_price,
      final_selling_price,
      image_url,
      size_or_quantity || null,
    ]);
    const product_id = result.lastID;

    // Create inventory record with 100 stock
    await database.run(
      `INSERT INTO inventory (product_id, available_stock, reserved_stock, reorder_level)
       VALUES (?, 100, 0, 10)`,
      [product_id]
    );

    response.send('Product added successfully');
  } catch (err) {
    response.status(500).send('Database error: ' + err.message);
  }
});

// Get all products
app.get('/products/', async (req, res) => {
  try {
    const products = await database.all(`
      SELECT 
        p.product_id,
        p.supplier_id,
        p.category_id,
        p.product_name,
        p.description,
        p.sku,
        p.manufacture_date,
        p.cost_price,
        p.selling_price,
        p.image_url,
        p.size_or_quantity,
        p.product_status,
        p.created_at,
        p.updated_at,
        c.category_name,
        IFNULL(AVG(r.rating), 0) as average_rating
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN reviews r ON p.product_id = r.product_id
      GROUP BY p.product_id
    `);
    res.json(products);
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

// Get a single product
app.get('/products/:product_id', async (req, res) => {
  const { product_id } = req.params;
  try {
    const product = await database.get(
      `SELECT 
         p.product_id,
         p.supplier_id,
         p.category_id,
         p.product_name,
         p.description,
         p.sku,
         p.manufacture_date,
         p.cost_price,
         p.selling_price,
         p.image_url,
         p.size_or_quantity,
         p.product_status,
         p.created_at,
         p.updated_at,
         c.category_name,
         IFNULL(AVG(r.rating), 0) as average_rating
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.category_id
       LEFT JOIN reviews r ON p.product_id = r.product_id
       WHERE p.product_id = ?
       GROUP BY p.product_id`,
      [product_id]
    );
    if (product) {
      res.json(product);
    } else {
      res.status(404).send('Product not found');
    }
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

// Get all reviews for a specific product
app.get('/reviews/:product_id', async (req, res) => {
  const { product_id } = req.params;
  try {
    const reviews = await database.all(
      `SELECT r.review_id, r.product_id, r.user_id, r.rating, r.comment, r.created_at, u.username
       FROM reviews r
       JOIN users u ON r.user_id = u.user_id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`,
      [product_id]
    );
    res.json(reviews);
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

// Add a review
app.post('/reviews/', authenticateHeader, async (request, response) => {
  const { product_id, comment, rating } = request.body;
  const user_id = request.userId;

  if (!product_id || !rating) {
    response.status(400).send('Missing product_id or rating');
    return;
  }

  try {
    const existingReview = await database.get(
      'SELECT review_id FROM reviews WHERE product_id = ? AND user_id = ?',
      [product_id, user_id]
    );

    if (existingReview) {
      response.status(400).send('You have already reviewed this product');
      return;
    }

    const query = `
      INSERT INTO reviews (product_id, user_id, rating, comment)
      VALUES (?, ?, ?, ?)
    `;
    await database.run(query, [product_id, user_id, rating, comment || null]);
    response.send('Review added successfully');
  } catch (err) {
    response.status(500).send('Database error: ' + err.message);
  }
});

// Create a new cart
app.post('/carts/', authenticateHeader, async (req, res) => {
  try {
    const result = await database.run(
      `INSERT INTO cart (user_id, status) VALUES (?, 'active')`,
      [req.userId]
    );
    res.json({ cart_id: result.lastID, user_id: req.userId });
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

// Get user carts
app.get('/carts/', authenticateHeader, async (req, res) => {
  try {
    const carts = await database.all(
      `SELECT * FROM cart WHERE user_id = ? ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(carts);
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

// Add items to cart
app.post('/cart-items/', authenticateHeader, async (req, res) => {
  const { cart_id, product_id, quantity } = req.body;
  if (!cart_id || !product_id || !quantity) {
    res.status(400).send('Missing cart_id, product_id, or quantity');
    return;
  }
  try {
    const cart = await database.get('SELECT user_id FROM cart WHERE cart_id = ?', [cart_id]);
    if (!cart) {
      return res.status(404).send('Cart not found');
    }
    if (cart.user_id !== req.userId) {
      return res.status(403).send('Unauthorized access to cart');
    }

    const product = await database.get('SELECT selling_price FROM products WHERE product_id = ?', [product_id]);
    if (!product) {
      return res.status(400).send('Product not found');
    }
    const unit_price = product.selling_price;

    const existingItem = await database.get(
      'SELECT cart_item_id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cart_id, product_id]
    );

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      await database.run(
        `UPDATE cart_items SET quantity = ?, unit_price = ?, updated_at = datetime('now') WHERE cart_item_id = ?`,
        [newQty, unit_price, existingItem.cart_item_id]
      );
      res.json({ cart_item_id: existingItem.cart_item_id, cart_id, product_id, quantity: newQty });
    } else {
      const result = await database.run(
        `INSERT INTO cart_items (cart_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
        [cart_id, product_id, quantity, unit_price]
      );
      res.json({ cart_item_id: result.lastID, cart_id, product_id, quantity });
    }
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

// Get items in a cart
app.get('/cart-items', authenticateHeader, async (req, res) => {
  const cart_id = req.query.cart_id;
  if (!cart_id) {
    const activeCart = await database.get("SELECT cart_id FROM cart WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1", [req.userId]);
    if (!activeCart) {
      return res.json([]);
    }
    try {
      const items = await database.all(`SELECT * FROM cart_items WHERE cart_id = ?`, [activeCart.cart_id]);
      return res.json(items);
    } catch (err) {
      return res.status(500).send('Database error: ' + err.message);
    }
  }

  try {
    const cart = await database.get('SELECT user_id FROM cart WHERE cart_id = ?', [cart_id]);
    if (!cart) {
      return res.status(404).send('Cart not found');
    }
    if (cart.user_id !== req.userId) {
      return res.status(403).send('Unauthorized access to cart');
    }
    const items = await database.all(`SELECT * FROM cart_items WHERE cart_id = ?`, [cart_id]);
    res.json(items);
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

app.get('/cart-items/:cart_id', authenticateHeader, async (req, res) => {
  const { cart_id } = req.params;
  try {
    const cart = await database.get('SELECT user_id FROM cart WHERE cart_id = ?', [cart_id]);
    if (!cart) {
      return res.status(404).send('Cart not found');
    }
    if (cart.user_id !== req.userId) {
      return res.status(403).send('Unauthorized access to cart');
    }
    const items = await database.all(`SELECT * FROM cart_items WHERE cart_id = ?`, [cart_id]);
    res.json(items);
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

// Get user orders list
app.get('/orders/my-orders', authenticateHeader, async (req, res) => {
  try {
    const ordersList = await database.all(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY placed_at DESC',
      [req.userId]
    );
    res.json(ordersList);
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

// Get single order details
app.get('/orders/:id', authenticateHeader, async (req, res) => {
  const { id } = req.params;
  try {
    const order = await database.get(
      'SELECT * FROM orders WHERE order_id = ? AND user_id = ?',
      [id, req.userId]
    );
    if (!order) {
      return res.status(404).send('Order not found');
    }
    const items = await database.all(
      `SELECT oi.*, p.product_name, p.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.product_id
       WHERE oi.order_id = ?`,
      [id]
    );
    res.json({ ...order, items });
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

// Place order
app.post('/orders', authenticateHeader, async (request, response) => {
  const { name, email, address, phone, paymentMethod } = request.body;

  try {
    const activeCart = await database.get(
      "SELECT cart_id FROM cart WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [request.userId]
    );

    let itemsToOrder = [];
    if (activeCart) {
      itemsToOrder = await database.all(`
        SELECT ci.product_id, ci.quantity, ci.unit_price, p.supplier_id
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.product_id
        WHERE ci.cart_id = ?
      `, [activeCart.cart_id]);
    }

    if (itemsToOrder.length === 0 && request.body.items && request.body.items.length > 0) {
      for (const item of request.body.items) {
        const product = await database.get('SELECT supplier_id, selling_price FROM products WHERE product_id = ?', [item.id]);
        if (product) {
          itemsToOrder.push({
            product_id: item.id,
            quantity: item.quantity || 1,
            unit_price: product.selling_price,
            supplier_id: product.supplier_id
          });
        }
      }
    }

    if (itemsToOrder.length === 0) {
      return response.status(400).send('No items to place an order');
    }

    let subtotal = 0;
    for (const item of itemsToOrder) {
      subtotal += item.unit_price * item.quantity;
    }
    const shipping = subtotal > 500 ? 0 : 50;
    const tax = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + shipping + tax;

    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const dbMethod = paymentMethod === 'UPI' ? 'UPI' : 'COD';

    await database.run('BEGIN TRANSACTION');
    try {
      const createOrderQuery = `
        INSERT INTO orders
          (user_id, order_number, status, payment_method, payment_status, subtotal_amount, shipping_amount, tax_amount, total_amount, customer_name, customer_email, address_line_1, customer_phone)
        VALUES (?, ?, 'pending', ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = await database.run(createOrderQuery, [
        request.userId,
        orderNumber,
        dbMethod,
        subtotal,
        shipping,
        tax,
        total,
        name || request.username,
        email || 'customer@example.com',
        address || '',
        phone || ''
      ]);
      const order_id = result.lastID;

      for (const item of itemsToOrder) {
        const line_total = item.unit_price * item.quantity;
        await database.run(
          `INSERT INTO order_items (order_id, product_id, supplier_id, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [order_id, item.product_id, item.supplier_id, item.quantity, item.unit_price, line_total]
        );

        await database.run(
          `UPDATE inventory
           SET available_stock = MAX(0, available_stock - ?)
           WHERE product_id = ?`,
          [item.quantity, item.product_id]
        );
      }

      if (activeCart) {
        await database.run("UPDATE cart SET status = 'converted' WHERE cart_id = ?", [activeCart.cart_id]);
      }

      await database.run('COMMIT');

      sendOrderEmail(orderNumber, name || request.username, email || 'customer@example.com', address || '', dbMethod, itemsToOrder, total);

      response.status(201).json({ message: 'Order placed successfully', order_id, order_number: orderNumber });
    } catch (txErr) {
      await database.run('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    response.status(500).send('Database error: ' + err.message);
  }
});
