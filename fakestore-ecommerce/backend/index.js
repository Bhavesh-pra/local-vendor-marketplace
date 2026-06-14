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
  const {name, password, emailId, address, mobileNumber} = request.body

  const checkUser = `SELECT * FROM user WHERE name = '${name}'`
  const dbUser = await database.get(checkUser)

  if (dbUser !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(request.body.password, 10)
      const addUserQuery = `
        INSERT INTO 
          user (name, password, email_id, address, mobile_number)
        VALUES ('${name}', '${hashedPassword}', '${emailId}', '${address}', '${mobileNumber}') 
      `
      await database.run(addUserQuery)
      response.send('User created successfully')
    }
  }
})

//API 2
//SECTION 2:
app.post('/login/', async (request, response) => {
  const { name, password } = request.body;
  const checkUser = `SELECT * FROM user WHERE name = '${name}'`;
  const dbUser = await database.get(checkUser);

  if (dbUser === undefined) {
    response.status(400).send('Invalid user');
  } else {
    const passwordIsMatched = await bcrypt.compare(password, dbUser.password);
    if (passwordIsMatched === true) {
      const payload = { name: name };
      const jwtToken = jwt.sign(payload, 'HELLO_WORLD');
      // Return both JWT token and userId
      response.send({ jwtToken, userId: dbUser.user_id });
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
        request.name = payload.name
        next()
      }
    })
  }
}

//API 3
// Middleware to authenticate requester (reuse your authenticateHeader)

// API to add a product
app.post('/products/', authenticateHeader, async (request, response) => {
  const {
    product_name,
    category,
    description,
    date_of_manufacture,
    original_price,
    discounted_price,
    image_url,
    size_or_quantity,
  } = request.body;

  const user_name = request.name; // from JWT payload
  // Get user id from username
  const user = await database.get('SELECT user_id FROM user WHERE name = ?', [user_name]);

  if (!user) {
    return response.status(400).send('Invalid user');
  }

  if (
    !product_name ||
    !category ||
    !description ||
    !date_of_manufacture ||
    !original_price ||
    !discounted_price ||
    !image_url
  ) {
    return response.status(400).send('All fields except size_or_quantity are required');
  }

  try {
    const query = `
      INSERT INTO products_table
        (user_id, product_name, category, description, date_of_manufacture, original_price, discounted_price, image_url, size_or_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await database.run(query, [
      user.user_id,
      product_name,
      category,
      description,
      date_of_manufacture,
      original_price,
      discounted_price,
      image_url,
      size_or_quantity || null,
    ]);
    response.send('Product added successfully');
  } catch (err) {
    response.status(500).send('Database error: ' + err.message);
  }
});

//API4
// Get all reviews for a specific product_id
app.get('/reviews/:product_id', async (req, res) => {
  const { product_id } = req.params;
  try {
    const reviews = await database.all(
      'SELECT * FROM review_table WHERE product_id = ? ORDER BY review_date DESC',
      [product_id]
    );
    res.json(reviews);
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

//API5
app.post('/reviews/', async (request, response) => {
  const { product_id, user_id, comment, review_date } = request.body;
  if (!product_id || !user_id || !comment || !review_date) {
    response.status(400).send('Missing required fields');
    return;
  }
  try {
    const query = `
      INSERT INTO review_table (product_id, user_id, comment, review_date)
      VALUES (?, ?, ?, ?)
    `;
    await database.run(query, [product_id, user_id, comment, review_date]);
    response.send('Review added successfully');
  } catch (err) {
    response.status(500).send('Database error: ' + err.message);
  }
});

//API 6
// Get all products
app.get('/products/', async (req, res) => {
  try {
    const products = await database.all(`
      SELECT p.*, IFNULL(AVG(r.rating), 0) as average_rating
      FROM products_table p
      LEFT JOIN rating_table r ON p.product_id = r.product_id
      GROUP BY p.product_id
    `);
    res.json(products);
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});



//API 7
app.post('/ratings/', async (req, res) => {
  const { product_id, rating } = req.body;
  if (!product_id || !rating) {
    res.status(400).send('Missing product_id or rating');
    return;
  }
  try {
    const query = `
      INSERT INTO rating_table (product_id, rating)
      VALUES (?, ?)
    `;
    await database.run(query, [product_id, rating]);
    res.send('Rating added successfully');
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});
//API 8
app.get('/ratings/:product_id', async (req, res) => {
  const { product_id } = req.params;
  try {
    const ratings = await database.all(
      'SELECT rating FROM rating_table WHERE product_id = ?',
      [product_id]
    );
    if (ratings.length === 0) {
      res.json({ ratings: [], average: null });
      return;
    }
    const ratingsList = ratings.map(r => r.rating);
    const average =
      ratingsList.reduce((sum, x) => sum + x, 0) / ratingsList.length;
    res.json({ ratings: ratingsList, average });
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

//API 9
app.post('/carts/', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    res.status(400).send('Missing user_id');
    return;
  }
  try {
    const result = await database.run(
      `INSERT INTO cart_table (user_id) VALUES (?)`,
      [user_id]
    );
    // Return the newly created cart_id
    res.json({ cart_id: result.lastID, user_id });
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});


//API 10
app.get('/carts/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const carts = await database.all(
      `SELECT * FROM cart_table WHERE user_id = ?`,
      [user_id]
    );
    res.json(carts);
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});


//API 11
app.post('/cart-items/', async (req, res) => {
  const { cart_id, product_id, quantity } = req.body;
  if (!cart_id || !product_id || !quantity) {
    res.status(400).send('Missing cart_id, product_id, or quantity');
    return;
  }
  try {
    const result = await database.run(
      `INSERT INTO cart_item_table (cart_id, product_id, quantity) VALUES (?, ?, ?)`,
      [cart_id, product_id, quantity]
    );
    // Return the newly created cart_item_id
    res.json({ cart_item_id: result.lastID, cart_id, product_id, quantity });
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});


//API 12
app.get('/cart-items/:cart_id', async (req, res) => {
  const { cart_id } = req.params;
  try {
    const items = await database.all(
      `SELECT * FROM cart_item_table WHERE cart_id = ?`,
      [cart_id]
    );
    res.json(items);
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

//API 13
app.get('/products/:product_id', async (req, res) => {
  const { product_id } = req.params;
  try {
    const product = await database.get(
      `SELECT p.*, IFNULL(AVG(r.rating), 0) as average_rating
       FROM products_table p
       LEFT JOIN rating_table r ON p.product_id = r.product_id
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


app.post('/create-order', (req, res) => {
  const order = req.body;

  // Format purchased items as text
  const itemsText = order.items
    .map(item => `Item: ${item.title} - Price: $${item.price}`)
    .join('\n');

  const mailText = `
Order Details:
Name: ${order.name}
Email: ${order.email}
Address: ${order.address}
Payment Method: ${order.paymentMethod}
Order Type: ${order.giftWrap}

Purchased Items:
${itemsText}
  `;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.MAIL_RECEIVER,
    subject: 'New Order Placed',
    text: mailText,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email:', err);
      return res.status(500).json({ message: 'Failed to send email' });
    }
    console.log('Email sent:', info.response);
    res.status(200).json({ message: 'Order received and email sent' });
  });
});
