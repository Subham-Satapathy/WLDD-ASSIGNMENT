const { AppError } = require('../utils/errors');

// Log error details
const logError = (err, req) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode || 500
    },
    request: {
      method: req.method,
      url: req.url,
      body: req.body,
      params: req.params,
      query: req.query,
      user: req.user ? req.user._id : null
    }
  };
  
  // Log error details - in production, you'd want to use a proper logging service
  console.error('Error Log:', JSON.stringify(errorLog, null, 2));
};

// Format error response based on environment
const formatError = (err, includeStack = false) => {
  const response = {
    status: err.status || 'error',
    statusCode: err.statusCode || 500,
    message: err.message,
    errorCode: err.errorCode || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  };

  if (err.errors) {
    response.errors = err.errors;
  }

  if (err.details) {
    response.details = err.details;
  }

  if (includeStack && err.stack) {
    response.stack = err.stack;
  }

  return response;
};

const errorHandler = (err, req, res, next) => {
  // Log all errors
  logError(err, req);

  // Set default status code if not set
  err.statusCode = err.statusCode || 500;

  // Format validation errors
  if (err.errors && Array.isArray(err.errors)) {
    const statusCode = err.statusCode || 400;
    
    return res.status(statusCode).json({
      status: 'fail',
      statusCode: statusCode,
      message: err.message || 'Validation Error',
      errorCode: err.errorCode || 'VALIDATION_ERROR',
      errors: err.errors,
      details: err.details || undefined,
      timestamp: new Date().toISOString()
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      value: e.value
    }));
    
    return res.status(400).json({
      status: 'fail',
      statusCode: 400,
      message: 'Validation Error',
      errorCode: 'VALIDATION_ERROR',
      errors,
      timestamp: new Date().toISOString()
    });
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      status: 'fail',
      statusCode: 409,
      message: `Duplicate value for ${field}`,
      errorCode: 'DUPLICATE_KEY',
      field,
      timestamp: new Date().toISOString()
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'fail',
      statusCode: 401,
      message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
      errorCode: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  // Handle custom application errors
  if (err instanceof AppError) {
    const response = {
      status: 'fail',
      statusCode: err.statusCode,
      message: err.message,
      error: err.message,
      errorCode: err.errorCode || 'APPLICATION_ERROR',
      timestamp: new Date().toISOString(),
      ...(err.errors && { errors: err.errors }),
      ...(err.details && { details: err.details })
    };

    // Add retryAfter for rate limit errors
    if (err.errorCode === 'RATE_LIMIT_EXCEEDED' && err.retryAfter) {
      response.retryAfter = err.retryAfter;
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle uncaught errors
  const isDev = process.env.NODE_ENV === 'development';
  const response = {
    status: 'error',
    statusCode: err.statusCode || 500,
    message: isDev ? err.message : 'Internal Server Error',
    errorCode: err.errorCode || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  };

  if (err.details) {
    response.details = err.details;
  }

  if (err.errors) {
    response.errors = err.errors;
  }

  if (isDev && err.stack) {
    response.stack = err.stack;
  }

  res.status(err.statusCode || 500).json(response);
};

module.exports = errorHandler;