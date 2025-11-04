const errorHandler = require('../src/middleware/errorHandler');
const {
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  DatabaseError
} = require('../src/utils/errors');

describe('Error Handler Middleware', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;
  let originalEnv;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: '/test',
      body: {},
      params: {},
      query: {},
      user: { _id: 'testUserId' }
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
    originalEnv = process.env.NODE_ENV;
    console.error = jest.fn(); // Mock console.error
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
  });

  it('should handle ValidationError with mongoose format', () => {
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';
    validationError.errors = {
      field1: { path: 'field1', message: 'Field1 is required', value: '' },
      field2: { path: 'field2', message: 'Field2 is invalid', value: 'invalid' }
    };

    errorHandler(validationError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      statusCode: 400,
      message: 'Validation Error',
      errorCode: 'VALIDATION_ERROR',
      errors: expect.arrayContaining([
        expect.objectContaining({
          field: 'field1',
          message: 'Field1 is required',
          value: ''
        }),
        expect.objectContaining({
          field: 'field2',
          message: 'Field2 is invalid',
          value: 'invalid'
        })
      ])
    }));
  });

  it('should handle duplicate key errors', () => {
    const duplicateError = {
      code: 11000,
      keyPattern: { email: 1 },
      keyValue: { email: 'test@example.com' }
    };

    errorHandler(duplicateError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      statusCode: 409,
      message: 'Duplicate value for email',
      errorCode: 'DUPLICATE_KEY',
      timestamp: expect.any(String)
    }));
  });

  it('should handle JWT errors', () => {
    const jwtError = new Error('invalid token');
    jwtError.name = 'JsonWebTokenError';

    errorHandler(jwtError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      statusCode: 401,
      message: 'Invalid token',
      errorCode: 'INVALID_TOKEN'
    }));
  });

  it('should handle errors in production mode', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('Internal test error');
    error.stack = 'Error stack trace';

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      statusCode: 500,
      message: 'Internal Server Error',
      errorCode: 'INTERNAL_ERROR'
    }));
    expect(mockResponse.json).not.toHaveBeenCalledWith(
      expect.objectContaining({ stack: expect.any(String) })
    );
  });

  it('should include detailed error info in development mode', () => {
    process.env.NODE_ENV = 'development';
    const error = new Error('Detailed error message');
    error.stack = 'Error stack trace';

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      statusCode: 500,
      message: 'Detailed error message',
      errorCode: 'INTERNAL_ERROR',
      timestamp: expect.any(String)
    }));
  });

  it('should handle custom AppError instances', () => {
    const appError = new AppError('Custom error', 422, 'CUSTOM_ERROR');
    errorHandler(appError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(422);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      statusCode: 422,
      message: 'Custom error',
      errorCode: 'CUSTOM_ERROR',
      timestamp: expect.any(String)
    }));
  });

  it('should handle NotFoundError', () => {
    const notFoundError = new NotFoundError('Resource not found');
    errorHandler(notFoundError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      statusCode: 404,
      message: 'Resource not found',
      errorCode: 'RESOURCE_NOT_FOUND',
      timestamp: expect.any(String)
    }));
  });

  it('should handle expired JWT tokens', () => {
    const tokenError = new Error('jwt expired');
    tokenError.name = 'TokenExpiredError';

    errorHandler(tokenError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      statusCode: 401,
      message: 'Token expired',
      errorCode: 'TOKEN_EXPIRED'
    }));
  });

  it('should handle database errors', () => {
    const dbError = new Error('Database connection failed');
    dbError.name = 'MongoError';
    errorHandler(dbError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      statusCode: 500,
      message: 'Internal Server Error',
      errorCode: 'INTERNAL_ERROR',
      timestamp: expect.any(String)
    }));
  });

  it('should log error details', () => {
    const error = new Error('Database connection failed');
    error.name = 'MongoError';
    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(console.error).toHaveBeenCalledWith(
      'Error Log:',
      expect.any(String)
    );

    const logCall = console.error.mock.calls[0][1];
    const parsedLog = JSON.parse(logCall);
    
    expect(parsedLog).toHaveProperty('timestamp');
    expect(parsedLog).toHaveProperty('error');
    expect(parsedLog.error).toHaveProperty('name', 'MongoError');
    expect(parsedLog.error).toHaveProperty('message', 'Database connection failed');
    expect(parsedLog.request).toHaveProperty('method', 'GET');
    expect(parsedLog.request).toHaveProperty('url', '/test');
    expect(parsedLog.request).toHaveProperty('user', 'testUserId');
  });
});