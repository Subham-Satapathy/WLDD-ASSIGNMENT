const errorHandler = require('../src/middleware/errorHandler');

describe('Error Handler Middleware', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  it('should handle ValidationError', () => {
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';
    validationError.errors = {
      field1: { message: 'Field1 is required' },
      field2: { message: 'Field2 is invalid' }
    };

    errorHandler(validationError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Validation Error',
      errors: ['Field1 is required', 'Field2 is invalid']
    });
  });

  it('should handle duplicate key errors', () => {
    const duplicateError = new Error('Duplicate key error');
    duplicateError.code = 11000;

    errorHandler(duplicateError, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Duplicate key error',
      error: duplicateError.message
    });
  });

  it('should handle generic errors in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Something bad happened');
    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Internal Server Error',
      error: 'Something went wrong'
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should include error message in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Detailed error message');
    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Internal Server Error',
      error: 'Detailed error message'
    });

    process.env.NODE_ENV = originalEnv;
  });
});