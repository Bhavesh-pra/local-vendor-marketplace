require('dotenv').config();

// 1. Startup environment variable validation
const requiredEnv = ['JWT_SECRET', 'DATABASE_PATH', 'FRONTEND_URL', 'PORT', 'NODE_ENV'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`FATAL ERROR: Environment variable ${key} is missing.`);
    process.exit(1);
  }
}

const express = require('express');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');
const { createAuthController }    = require('./controllers/authController');
const { createProductController } = require('./controllers/productController');
const { createReviewController }  = require('./controllers/reviewController');
const { createCartController }    = require('./controllers/cartController');
const { createOrderController }   = require('./controllers/orderController');
const { createAdminController }   = require('./controllers/adminController');
const { createReturnController }  = require('./controllers/returnController');
const { createAuthRoutes }    = require('./routes/authRoutes');
const { createProductRoutes } = require('./routes/productRoutes');
const { createReviewRoutes }  = require('./routes/reviewRoutes');
const { createCartRoutes }    = require('./routes/cartRoutes');
const { createOrderRoutes }   = require('./routes/orderRoutes');
const { createAdminRoutes }   = require('./routes/adminRoutes');
const { createReturnRoutes }  = require('./routes/returnRoutes');
const { createAnalyticsController } = require('./controllers/analyticsController');
const { createAnalyticsRoutes } = require('./routes/analyticsRoutes');
const { createCouponController } = require('./controllers/couponController');
const { createCouponRoutes } = require('./routes/couponRoutes');
const { createNotificationController } = require('./controllers/notificationController');
const { createNotificationRoutes } = require('./routes/notificationRoutes');
const { sendOrderEmail } = require('./services/emailService');
const { createPurchaseOrderController } = require('./controllers/purchaseOrderController');
const { createPurchaseOrderRoutes } = require('./routes/purchaseOrderRoutes');
const { createPaymentController } = require('./controllers/paymentController');
const { createPayoutController } = require('./controllers/payoutController');
const { createPaymentRoutes } = require('./routes/paymentRoutes');

// Import new middlewares
const { securityHeaders, corsMiddleware, limiter } = require('./middleware/security');
const { requestLogger, logger } = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Wire up structured logging, security headers, CORS, rate limiter
app.use(requestLogger);
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(limiter);

// Enforce request size limits (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health Check Endpoints ─────────────────────────────────────────

// /api/health confirms the process is alive
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, status: 'OK', uptime: process.uptime() });
});

// /api/live confirms the application is not deadlocked (event loop/memory)
app.get('/api/live', (req, res) => {
  const start = Date.now();
  setTimeout(() => {
    const delay = Date.now() - start;
    const memoryUsage = process.memoryUsage();
    // Event loop healthy if delay < 100ms, memory healthy if RSS < 1GB
    const isHealthy = delay < 100 && memoryUsage.rss < 1024 * 1024 * 1024;
    
    if (isHealthy) {
      res.status(200).json({
        success: true,
        status: 'live',
        event_loop_delay_ms: delay,
        memory: {
          rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
          heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024)
        }
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        reason: 'Resource limit or event loop delay detected',
        event_loop_delay_ms: delay
      });
    }
  }, 0);
});

// /api/ready checks database connection, missing migrations, write access
app.get('/api/ready', async (req, res) => {
  try {
    const db = require('./db').getDb();
    if (!db) {
      return res.status(503).json({ success: false, status: 'not ready', reason: 'Database connection offline' });
    }
    
    // DB Check
    await db.get('SELECT 1');

    // Migrations check
    const migrationsTable = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_versions'`);
    if (!migrationsTable) {
      return res.status(503).json({ success: false, status: 'not ready', reason: 'Database migrations table missing' });
    }
    const migration = await db.get(`SELECT version FROM schema_versions WHERE version='v1.0.0'`);
    if (!migration) {
      return res.status(503).json({ success: false, status: 'not ready', reason: 'Pending migrations' });
    }

    // Disk write check
    try {
      const uploadsDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.accessSync(uploadsDir, fs.constants.W_OK);
    } catch (e) {
      return res.status(503).json({ success: false, status: 'not ready', reason: 'Uploads directory not writable' });
    }

    res.status(200).json({ success: true, status: 'ready' });
  } catch (err) {
    res.status(503).json({ success: false, status: 'not ready', reason: err.message });
  }
});

let server;

const initializeDbAndServer = async () => {
  try {
    const database = await initDb();

    const authController    = createAuthController(database);
    const productController = createProductController(database);
    const reviewController  = createReviewController(database);
    const cartController    = createCartController(database);
    const orderController   = createOrderController(database, sendOrderEmail);
    const adminController   = createAdminController(database);
    const returnController  = createReturnController(database);
    const analyticsController = createAnalyticsController(database);
    const couponController = createCouponController(database);
    const notificationController = createNotificationController(database);
    const purchaseOrderController = createPurchaseOrderController(database);
    const paymentController = createPaymentController(database);
    const payoutController = createPayoutController(database);

    // ─── Phase 7 API Response Time Telemetry Middleware ─────────────────
    app.use((req, res, next) => {
      const start = process.hrtime();
      res.on('finish', () => {
        const diff = process.hrtime(start);
        const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6);
        const path = req.path;
        if (!path.startsWith('/uploads') && !path.startsWith('/static') && path !== '/favicon.ico') {
          database.run(`
            INSERT INTO api_metrics (method, path, status_code, duration_ms)
            VALUES (?, ?, ?, ?)
          `, [req.method, path, res.statusCode, durationMs]).catch((err) => {
            // Silently absorb logging failures in production
          });
        }
      });
      next();
    });

    // Auth routes manage their own route-specific rate limits
    app.use(createAuthRoutes(authController));

    app.use(createProductRoutes(productController));
    app.use(createReviewRoutes(reviewController));
    app.use(createCartRoutes(cartController));
    app.use(createOrderRoutes(orderController));
    app.use(createAdminRoutes(adminController));
    app.use(createReturnRoutes(returnController));
    app.use(createAnalyticsRoutes(analyticsController));
    app.use(createCouponRoutes(couponController));
    app.use(createNotificationRoutes(notificationController));
    app.use(createPurchaseOrderRoutes(purchaseOrderController));
    app.use('/api/payments', createPaymentRoutes(database, paymentController, payoutController));

    // Fallback error handler
    app.use(errorHandler);

    const PORT = process.env.PORT || 3000;
    server = app.listen(PORT, () =>
      logger.info('SERVER_STARTED', { url: `http://localhost:${PORT}/`, port: PORT })
    );
  } catch (error) {
    logger.error('DB_CONNECTION_ERROR', { error: error.message });
    process.exit(1);
  }
};

initializeDbAndServer();

// Graceful Shutdown
const gracefulShutdown = (signal) => {
  logger.info('SHUTDOWN_SIGNAL_RECEIVED', { signal });
  if (server) {
    server.close(async () => {
      logger.info('HTTP_SERVER_CLOSED');
      try {
        const db = require('./db').getDb();
        if (db) {
          await db.close();
          logger.info('DATABASE_CLOSED');
        }
        logger.info('GRACEFUL_SHUTDOWN_COMPLETE');
        process.exit(0);
      } catch (err) {
        logger.error('SHUTDOWN_ERROR', { error: err.message });
        process.exit(1);
      }
    });

    // Force terminate after 10s if hanging
    setTimeout(() => {
      logger.warn('SHUTDOWN_FORCED', { reason: 'Timeout closing server' });
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
