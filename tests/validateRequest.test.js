const { body } = require('express-validator');
const validateRequest = require('../src/middleware/validateRequest');

describe('Request Validation Middleware', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  const testValidation = [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password too short')
  ];

  it('should pass validation with valid data', async () => {
    mockRequest.body = {
      email: 'test@example.com',
      password: 'password123'
    };

    const middleware = validateRequest(testValidation);
    await middleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(nextFunction).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it('should fail validation with invalid data', async () => {
    mockRequest.body = {
      email: 'invalid-email',
      password: '12345'
    };

    const middleware = validateRequest(testValidation);
    await middleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: 'Invalid email'
          }),
          expect.objectContaining({
            field: 'password',
            message: 'Password too short'
          })
        ])
      })
    );
  });

  it('should handle missing required fields', async () => {
    mockRequest.body = {};

    const middleware = validateRequest([
      body('name').notEmpty().withMessage('Name is required')
    ]);
    await middleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            message: 'Name is required'
          })
        ])
      })
    );
  });

  it('should run all validations', async () => {
    mockRequest.body = {
      email: 'invalid',
      age: 'not-a-number'
    };

    const middleware = validateRequest([
      body('email').isEmail().withMessage('Invalid email'),
      body('age').isInt().withMessage('Age must be a number')
    ]);
    await middleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'email' }),
          expect.objectContaining({ field: 'age' })
        ])
      })
    );
  });

  it('should include error code in validation error', async () => {
    mockRequest.body = {
      email: 'invalid-email'
    };

    const middleware = validateRequest(testValidation);
    await middleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'REQUEST_VALIDATION_ERROR'
      })
    );
  });
});