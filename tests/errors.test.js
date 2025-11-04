const {
  AppError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  RateLimitError,
  DatabaseError,
  CacheError
} = require('../src/utils/errors');

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.status).toBe('fail');
      expect(error.isOperational).toBe(true);
      expect(error.errorCode).toBe('TEST_ERROR');
      expect(error.timestamp).toBeDefined();
    });

    it('should format error to JSON correctly', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      const jsonError = error.toJSON();

      expect(jsonError).toEqual({
        status: 'fail',
        statusCode: 400,
        message: 'Test error',
        errorCode: 'TEST_ERROR',
        timestamp: expect.any(String)
      });
    });
  });

  describe('NotFoundError', () => {
    it('should create NotFoundError with default message', () => {
      const error = new NotFoundError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
      expect(error.errorCode).toBe('RESOURCE_NOT_FOUND');
    });

    it('should create NotFoundError with custom message and code', () => {
      const error = new NotFoundError('Custom not found', 'CUSTOM_NOT_FOUND');
      
      expect(error.message).toBe('Custom not found');
      expect(error.errorCode).toBe('CUSTOM_NOT_FOUND');
    });
  });

  describe('AuthenticationError', () => {
    it('should create AuthenticationError with correct properties', () => {
      const error = new AuthenticationError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
      expect(error.errorCode).toBe('AUTH_FAILED');
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with errors array', () => {
      const errors = [
        { field: 'email', message: 'Invalid email' }
      ];
      const error = new ValidationError('Validation failed', errors);
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.errors).toEqual(errors);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should format ValidationError to JSON with errors', () => {
      const errors = [
        { field: 'email', message: 'Invalid email' }
      ];
      const error = new ValidationError('Validation failed', errors);
      const jsonError = error.toJSON();

      expect(jsonError.errors).toEqual(errors);
    });
  });

  describe('RateLimitError', () => {
    it('should create RateLimitError with correct status code', () => {
      const error = new RateLimitError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(429);
      expect(error.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('DatabaseError', () => {
    it('should create DatabaseError as non-operational error', () => {
      const error = new DatabaseError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
      expect(error.errorCode).toBe('DB_ERROR');
    });
  });

  describe('CacheError', () => {
    it('should create CacheError with correct properties', () => {
      const error = new CacheError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(500);
      expect(error.errorCode).toBe('CACHE_ERROR');
    });
  });
});