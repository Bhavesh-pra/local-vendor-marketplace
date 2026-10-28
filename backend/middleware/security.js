const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 1. Helmet Configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "/uploads"],
      connectSrc: ["'self'"],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 15552000, // 180 days
    includeSubDomains: true,
    preload: true
  },
  xssFilter: true, // X-XSS-Protection header
  noSniff: true, // X-Content-Type-Options: nosniff
  frameguard: { action: 'deny' }
});

// 2. Strict CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or curl requests if origin is not provided
    if (!origin) return callback(null, true);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // In development mode, allow localhost/127.0.0.1
    if (process.env.NODE_ENV !== 'production') {
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    // Strict origin validation in production
    if (origin === frontendUrl) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Idempotency-Key']
};
const corsMiddleware = cors(corsOptions);

// 3. Rate Limiter (sliding window rate limit)
// Rate limiting configuration with documented transition path to Redis for scaling in Phase 13
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Admin dashboards make many parallel reads; auth routes stay separately throttled.
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false, 
    message: 'High traffic detected. Please wait a moment and try again.' 
  }
});

// Login should feel forgiving for legitimate users with flaky devices,
// while still slowing obvious brute-force attempts.
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Allow a few bad attempts before cooling down
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 5 minutes before trying again.'
  }
});

// Registration is lower-volume, so keep it tighter but not punitive.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts. Please wait 15 minutes before trying again.'
  }
});

// Session refresh should not be punished as harshly as login.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many session refresh attempts. Please try again later.'
  }
});

// 4. File Upload Validation (Magic Bytes, Size, Extension, Path Traversal)
const validateUploadedFile = (fileName, fileData, allowedTypes = ['image', 'video']) => {
  // Prevent Path Traversal
  const baseName = path.basename(fileName);
  if (baseName !== fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    throw new Error('Path traversal detected in file name');
  }

  const ext = path.extname(fileName).toLowerCase();
  const allowedExtensions = [];
  if (allowedTypes.includes('image')) {
    allowedExtensions.push('.jpg', '.jpeg', '.png', '.gif', '.webp');
  }
  if (allowedTypes.includes('video')) {
    allowedExtensions.push('.mp4');
  }

  if (!allowedExtensions.includes(ext)) {
    throw new Error(`File extension ${ext} is not allowed`);
  }

  // Base64 decoding
  const base64Data = fileData.includes(';base64,') ? fileData.split(';base64,')[1] : fileData;
  const buffer = Buffer.from(base64Data, 'base64');

  // Request Size limit verification (Max 10MB)
  const maxSizeBytes = 10 * 1024 * 1024;
  if (buffer.length > maxSizeBytes) {
    throw new Error('File exceeds maximum size of 10MB');
  }

  // Validate File Signatures (Magic Bytes)
  const hex = buffer.toString('hex', 0, 4).toLowerCase();
  let verified = false;

  // JPEG: ff d8 ff
  if (ext === '.jpg' || ext === '.jpeg') {
    verified = hex.startsWith('ffd8ff');
  }
  // PNG: 89 50 4e 47
  else if (ext === '.png') {
    verified = hex.startsWith('89504e47');
  }
  // GIF: 47 49 46 38 ("GIF8")
  else if (ext === '.gif') {
    verified = hex.startsWith('47494638');
  }
  // WebP: RIFF ... WEBP (starts with 52 49 46 46 "RIFF")
  else if (ext === '.webp') {
    verified = hex.startsWith('52494646');
  }
  // MP4: 00 00 00 (starts with ftype box, e.g., 00 00 00 18 66 74 79 70 or similar)
  else if (ext === '.mp4') {
    verified = hex.substring(8, 16) === '66747970' || hex.startsWith('000000');
  }

  if (!verified) {
    throw new Error('Invalid file content signature (magic bytes mismatch)');
  }

  return { buffer, uniqueName: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}` };
};

module.exports = {
  securityHeaders,
  corsMiddleware,
  limiter,
  authLimiter: loginLimiter,
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  validateUploadedFile
};
