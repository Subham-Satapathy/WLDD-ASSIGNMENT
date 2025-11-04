class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errorCode = errorCode;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      status: this.status,
      statusCode: this.statusCode,
      message: this.message,
      errorCode: this.errorCode,
      timestamp: this.timestamp,
      ...(this.errors && { errors: this.errors })
    };
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', errorCode = 'RESOURCE_NOT_FOUND') {
    super(message, 404, errorCode);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', errorCode = 'AUTH_FAILED') {
    super(message, 401, errorCode);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Not authorized', errorCode = 'ACCESS_DENIED') {
    super(message, 403, errorCode);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = [], errorCode = 'VALIDATION_ERROR') {
    super(message, 400, errorCode);
    this.errors = errors;
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', errorCode = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, errorCode);
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', errorCode = 'DB_ERROR') {
    super(message, 500, errorCode);
    this.isOperational = false;
  }
}

class CacheError extends AppError {
  constructor(message = 'Cache operation failed', errorCode = 'CACHE_ERROR') {
    super(message, 500, errorCode);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  RateLimitError,
  DatabaseError,
  CacheError
};