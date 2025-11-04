const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

/**
 * Middleware to validate request using express-validator
 * @param {Array} validations - Array of express-validator validation chains
 * @returns {Function} Express middleware
 */
const validateRequest = (validations) => {
  return async (req, res, next) => {
    try {
      // Run all validations
      await Promise.all(validations.map(validation => validation.run(req)));

      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }

      // Format validation errors
      const formattedErrors = errors.array().map(err => ({
        field: err.param || err.path,
        message: err.msg,
        value: err.value
      }));

      // Create validation error with proper format
      const error = new ValidationError('Validation failed', formattedErrors);
      error.statusCode = 400;
      error.errorCode = 'REQUEST_VALIDATION_ERROR';
      error.errors = formattedErrors;
      error.details = { isRequestValidation: true };

      next(error);
    } catch (error) {
      error.statusCode = 500;
      error.errorCode = 'INTERNAL_ERROR';
      next(error);
    }
  };
};

module.exports = validateRequest;