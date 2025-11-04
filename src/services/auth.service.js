const User = require('../models/user.model');
const jwt = require('jsonwebtoken');

class AuthService {
  /**
   * Create a new user
   * @param {Object} userData - User data (name, email, password)
   * @returns {Promise<{user: Object, token: string}>}
   */
  async signup(userData) {
    const { name, email, password } = userData;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error('Email already registered');
      error.statusCode = 400;
      throw error;
    }

    const user = new User({ name, email, password });
    await user.save();
    const token = this.generateToken(user._id);

    return { user, token };
  }

  /**
   * Authenticate user and generate token
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<{user: Object, token: string}>}
   */
  async login(email, password) {
    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT token
    const token = this.generateToken(user._id);

    return { user, token };
  }

  /**
   * Generate JWT token
   * @param {string} userId - User ID
   * @returns {string} JWT token
   */
  generateToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}

module.exports = new AuthService();