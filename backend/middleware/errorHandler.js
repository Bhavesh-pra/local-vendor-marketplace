const { logger } = require('./logger');

const errorHandler = (err, req, res, next) => {
  const reqId = req.requestId || 'req_unknown';
  const statusCode = err.status || err.statusCode || 500;
  
  logger.error('UNHANDLED_EXCEPTION', {
    request_id: reqId,
    message: err.message,
    status: statusCode,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });

  const responseBody = {
    success: false,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred.',
    request_id: reqId
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
};

module.exports = errorHandler;
