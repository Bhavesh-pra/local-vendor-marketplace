const crypto = require('crypto');

const logStructured = (level, type, data) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    type,
    ...data
  }));
};

const requestLogger = (req, res, next) => {
  const reqId = req.headers['x-request-id'] || `req_${crypto.randomUUID().substring(0, 8)}`;
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);

  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6);

    const logData = {
      request_id: reqId,
      user_id: req.userId || null,
      method: req.method,
      route: req.originalUrl || req.url,
      duration_ms: durationMs,
      status_code: res.statusCode
    };

    if (durationMs > 500) {
      logStructured('WARNING', 'API_SLOW_ENDPOINT', logData);
    } else {
      logStructured('INFO', 'API_REQUEST', logData);
    }
  });

  next();
};

const logger = {
  info: (type, data) => logStructured('INFO', type, data),
  warn: (type, data) => logStructured('WARNING', type, data),
  error: (type, data) => logStructured('ERROR', type, data),
  
  logSecurityEvent: (event, data) => logStructured('WARNING', 'SECURITY_EVENT', { event, ...data }),
  logAuthFailure: (username, reason, data) => logStructured('WARNING', 'AUTH_FAILURE', { username, reason, ...data }),
  logPaymentFailure: (paymentId, error, data) => logStructured('ERROR', 'PAYMENT_FAILURE', { paymentId, error, ...data }),
  logAdminAction: (adminUserId, action, target, data) => logStructured('INFO', 'ADMIN_ACTION', { adminUserId, action, target, ...data })
};

module.exports = { requestLogger, logger };
