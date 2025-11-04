const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const RateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password (min 6 characters)
 *     responses:
 *       201:
 *         description: User successfully created
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Email already exists
 * 
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *     responses:
 *       200:
 *         description: Successfully logged in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token
 *       401:
 *         description: Invalid credentials
 */

// Import validation middleware
const validateRequest = require('../middleware/validateRequest');

// Get Redis client from app (will be set by main app)
let rateLimiter;
const getRateLimiter = (req) => {
  if (!rateLimiter) {
    const redisClient = req.app.get('redisClient');
    rateLimiter = new RateLimiter(redisClient);
  }
  return rateLimiter;
};

// Middleware to apply auth rate limiting
const authRateLimit = (req, res, next) => {
  const limiter = getRateLimiter(req);
  return limiter.authLimiter()(req, res, next);
};

// Validation schemas
const signupValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
];

// Routes with validation middleware
router.post('/signup', authRateLimit, validateRequest(signupValidation), authController.signup);
router.post('/login', authRateLimit, validateRequest(loginValidation), authController.login);

module.exports = router;