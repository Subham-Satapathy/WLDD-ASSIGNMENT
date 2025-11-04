const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const { 
  ValidationError,
  AuthenticationError,
  DatabaseError
} = require('../utils/errors');

class AuthService {
  /**
   * Create a new user
   * @param {Object} userData - User data (name, email, password)
   * @returns {Promise<{user: Object, token: string}>}
   */
  async signup(userData) {
    const { name, email, password } = userData;

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        const error = new ValidationError('Email already registered');
        error.statusCode = 400;
        error.errorCode = 'EMAIL_EXISTS';
        throw error;
      }

      const user = new User({ name, email, password });
      await user.save();
      const token = this.generateToken(user._id);
      return { user, token };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      if (error.name === 'ValidationError') {
        const valError = new ValidationError('Invalid input data', 
          Object.keys(error.errors).map(field => ({
            field,
            message: error.errors[field].message,
            value: error.errors[field].value
          }))
        );
        valError.statusCode = 400;
        valError.errorCode = 'VALIDATION_ERROR';
        throw valError;
      }
      const dbError = new DatabaseError('Error creating user');
      dbError.statusCode = 500;
      dbError.errorCode = 'INTERNAL_ERROR';
      throw dbError;
    }
  }

  /**
   * Authenticate user and generate token
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<{user: Object, token: string}>}
   */
  async login(email, password) {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        const error = new AuthenticationError('Invalid credentials');
        error.statusCode = 401;
        error.errorCode = 'INVALID_CREDENTIALS';
        throw error;
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        const error = new AuthenticationError('Invalid credentials');
        error.statusCode = 401;
        error.errorCode = 'INVALID_CREDENTIALS';
        throw error;
      }

      // Generate JWT token
      const token = this.generateToken(user._id);
      return { user, token };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      const dbError = new DatabaseError('Error logging in');
      dbError.statusCode = 500;
      dbError.errorCode = 'INTERNAL_ERROR';
      throw dbError;
    }
  }

  /**
   * Generate JWT token
   * @param {string} userId - User ID
   * @returns {string} JWT token
   */
  generateToken(userId) {
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    return jwt.sign(
      { userId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}

module.exports = new AuthService();