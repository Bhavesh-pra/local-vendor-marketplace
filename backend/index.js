require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is missing.");
  process.exit(1);
}

const express = require('express')
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');
const { createAuthController }    = require('./controllers/authController');
const { createProductController } = require('./controllers/productController');
const { createReviewController }  = require('./controllers/reviewController');
const { createCartController }    = require('./controllers/cartController');
const { createOrderController }   = require('./controllers/orderController');
const { createAdminController }   = require('./controllers/adminController');
const { createAuthRoutes }    = require('./routes/authRoutes');
const { createProductRoutes } = require('./routes/productRoutes');
const { createReviewRoutes }  = require('./routes/reviewRoutes');
const { createCartRoutes }    = require('./routes/cartRoutes');
const { createOrderRoutes }   = require('./routes/orderRoutes');
const { createAdminRoutes }   = require('./routes/adminRoutes');
const { sendOrderEmail } = require('./services/emailService');

const app = express()
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const initializeDbAndServer = async () => {
  try {
    const database = await initDb()

    const authController    = createAuthController(database);
    const productController = createProductController(database);
    const reviewController  = createReviewController(database);
    const cartController    = createCartController(database);
    const orderController   = createOrderController(database, sendOrderEmail);
    const adminController   = createAdminController(database);

    app.use(createAuthRoutes(authController));
    app.use(createProductRoutes(productController));
    app.use(createReviewRoutes(reviewController));
    app.use(createCartRoutes(cartController));
    app.use(createOrderRoutes(orderController));
    app.use(createAdminRoutes(adminController));

    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()
