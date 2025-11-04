const authService = require('../services/auth.service');
const { DatabaseError } = require('../utils/errors');

exports.signup = async (req, res, next) => {
  try {
    const { user, token } = await authService.signup(req.body);
    res.status(201).json({
      user,
      token,
      message: 'User created successfully'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      error.statusCode = 400;
      error.errorCode = 'VALIDATION_ERROR';
      error.errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      next(error);
    } else if (error.message === 'Email already registered') {
      error.statusCode = 409;
      error.errorCode = 'EMAIL_EXISTS';
      next(error);
    } else if (error.name === 'DatabaseError' || error.errorCode === 'INTERNAL_ERROR') {
      next(error);
    } else {
      const dbError = new DatabaseError('Error creating user');
      dbError.statusCode = 500;
      dbError.errorCode = 'INTERNAL_ERROR';
      next(dbError);
    }
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.login(email, password);
    
    res.status(200).json({ user, token });
  } catch (error) {
    if (error.name === 'ValidationError') {
      error.statusCode = 400;
      error.errorCode = 'VALIDATION_ERROR';
      error.errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      next(error);
    } else if (error.name === 'AuthenticationError' || error.errorCode === 'INVALID_CREDENTIALS') {
      next(error);
    } else if (error.name === 'DatabaseError' || error.errorCode === 'INTERNAL_ERROR') {
      next(error);
    } else {
      const dbError = new DatabaseError('Error logging in');
      dbError.statusCode = 500;
      dbError.errorCode = 'INTERNAL_ERROR';
      next(dbError);
    }
  }
};