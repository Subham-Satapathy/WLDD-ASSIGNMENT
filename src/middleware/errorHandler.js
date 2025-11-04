const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      message: 'Validation Error',
      errors
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      message: 'Duplicate key error',
      error: err.message
    });
  }

  if (err.statusCode === 409) {
    return res.status(409).json({
      error: err.message,
      details: err.details
    });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired'
    });
  }

  // Handle custom application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      ...(err.errors && { errors: err.errors })
    });
  }

  // Handle known error types
  if (err.message === 'Error fetching tasks' || 
      err.message === 'Error creating task' ||
      err.message === 'Invalid updates') {
    res.status(err.statusCode || 500).json({
      message: err.message,
      error: err.message
    });
  } else {
    // Handle unknown errors
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  }
};

module.exports = errorHandler;