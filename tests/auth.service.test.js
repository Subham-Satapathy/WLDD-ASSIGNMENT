const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../src/models/user.model');
const authService = require('../src/services/auth.service');

describe('Auth Service', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('signup', () => {
    const validUserData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    };

    it('should create a new user and return token', async () => {
      const result = await authService.signup(validUserData);

      // Verify user was created
      expect(result.user).toBeDefined();
      expect(result.user.name).toBe(validUserData.name);
      expect(result.user.email).toBe(validUserData.email);
      expect(result.user.password).not.toBe(validUserData.password); // Should be hashed
      
      // Verify token was generated
      expect(result.token).toBeDefined();
      const decoded = jwt.verify(result.token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(result.user._id.toString());
    });

    it('should not allow duplicate email', async () => {
      await authService.signup(validUserData);

      await expect(authService.signup(validUserData))
        .rejects
        .toThrow('Email already registered');
    });

    it('should hash the password', async () => {
      const { user } = await authService.signup(validUserData);
      
      // Password should be hashed
      expect(user.password).not.toBe(validUserData.password);
      
      // Should be able to verify the password
      const isValid = await bcrypt.compare(validUserData.password, user.password);
      expect(isValid).toBe(true);
    });

    it('should throw error if required fields are missing', async () => {
      const invalidData = { name: 'Test User' };
      
      await expect(authService.signup(invalidData))
        .rejects
        .toThrow();
    });
  });

  describe('login', () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    };

    beforeEach(async () => {
      await authService.signup(userData);
    });

    it('should authenticate valid credentials and return token', async () => {
      const result = await authService.login(userData.email, userData.password);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.token).toBeDefined();
      
      const decoded = jwt.verify(result.token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(result.user._id.toString());
    });

    it('should throw error for non-existent user', async () => {
      await expect(authService.login('nonexistent@example.com', 'password123'))
        .rejects
        .toThrow('Invalid credentials');
    });

    it('should throw error for incorrect password', async () => {
      await expect(authService.login(userData.email, 'wrongpassword'))
        .rejects
        .toThrow('Invalid credentials');
    });

    it('should return proper error status codes', async () => {
      try {
        await authService.login('nonexistent@example.com', 'password123');
      } catch (error) {
        expect(error.statusCode).toBe(401);
      }
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const userId = new mongoose.Types.ObjectId();
      const token = authService.generateToken(userId);

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(userId.toString());
      expect(decoded.exp).toBeDefined();
    });

    it('should set proper expiration time', () => {
      const userId = new mongoose.Types.ObjectId();
      const token = authService.generateToken(userId);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Token should expire in 24 hours (with 5 seconds tolerance for test execution time)
      const expectedExpiry = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      expect(decoded.exp).toBeGreaterThan(expectedExpiry - 5);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExpiry);
    });
  });
});