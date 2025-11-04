const { RateLimitError } = require('../utils/errors');

/**
 * Rate limiter middleware using Redis
 * Implements a sliding window rate limiting algorithm
 */
class RateLimiter {
  constructor(redisClient) {
    this.redisClient = redisClient;
  }

  /**
   * Create rate limiting middleware
   * @param {Object} options - Rate limiting options
   * @param {number} options.windowMs - Time window in milliseconds
   * @param {number} options.max - Maximum number of requests per window
   * @param {string} options.message - Error message when rate limit is exceeded
   * @param {Function} options.keyGenerator - Function to generate rate limit key
   * @returns {Function} Express middleware
   */
  createLimiter(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes default
      max = 100, // 100 requests per window default
      message = 'Too many requests, please try again later',
      keyGenerator = (req) => {
        // Use IP address or user ID if authenticated
        return req.user ? `user:${req.user._id}` : `ip:${this.getClientIp(req)}`;
      },
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = options;

    return async (req, res, next) => {
      try {
        // Skip if Redis is not available
        if (!this.redisClient || this.redisClient.status !== 'ready') {
          return next();
        }

        const key = `ratelimit:${keyGenerator(req)}`;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Remove old entries outside the current window
        await this.redisClient.zremrangebyscore(key, 0, windowStart);

        // Count requests in current window
        const requestCount = await this.redisClient.zcard(key);

        if (requestCount >= max) {
          // Get the oldest request timestamp to calculate retry-after
          const oldestRequest = await this.redisClient.zrange(key, 0, 0, 'WITHSCORES');
          
          let retryAfter = Math.ceil(windowMs / 1000);
          if (oldestRequest.length > 0) {
            const oldestTimestamp = parseInt(oldestRequest[1]); // Score is at index 1
            retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
          }

          res.set('Retry-After', String(retryAfter));
          res.set('X-RateLimit-Limit', max);
          res.set('X-RateLimit-Remaining', 0);
          res.set('X-RateLimit-Reset', new Date(now + retryAfter * 1000).toISOString());

          const error = new RateLimitError(message);
          error.retryAfter = retryAfter;
          throw error;
        }

        // Add current request to the window
        await this.redisClient.zadd(key, now, `${now}:${Math.random()}`);

        // Set expiry on the key (cleanup)
        await this.redisClient.expire(key, Math.ceil(windowMs / 1000));

        // Set rate limit headers
        res.set('X-RateLimit-Limit', max);
        res.set('X-RateLimit-Remaining', Math.max(0, max - requestCount - 1));
        res.set('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

        // Handle response tracking
        if (!skipSuccessfulRequests || !skipFailedRequests) {
          const originalSend = res.send;
          res.send = function (data) {
            const statusCode = res.statusCode;
            
            // Remove the request from count if needed
            if ((skipSuccessfulRequests && statusCode < 400) || 
                (skipFailedRequests && statusCode >= 400)) {
              // We already added it, so remove it
              redisClient.zrem(key, `${now}:${Math.random()}`).catch(() => {});
            }
            
            return originalSend.call(this, data);
          };
        }

        next();
      } catch (error) {
        if (error instanceof RateLimitError) {
          next(error);
        } else {
          // If rate limiting fails, don't block the request
          console.error('Rate limiter error:', error);
          next();
        }
      }
    };
  }

  /**
   * Get client IP address from request
   * @param {Object} req - Express request object
   * @returns {string} Client IP address
   */
  getClientIp(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }

  /**
   * Create a simple rate limiter for specific routes
   * @param {number} max - Maximum requests
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Function} Express middleware
   */
  limit(max, windowMs = 60000) {
    return this.createLimiter({ max, windowMs });
  }

  /**
   * Strict rate limiter for authentication endpoints
   * Prevents brute force attacks
   */
  authLimiter() {
    return this.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 requests per 15 minutes
      message: 'Too many authentication attempts, please try again later',
      keyGenerator: (req) => `auth:${this.getClientIp(req)}:${req.body.email || 'unknown'}`,
      skipSuccessfulRequests: true // Don't count successful logins
    });
  }

  /**
   * Moderate rate limiter for API endpoints
   */
  apiLimiter() {
    return this.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per 15 minutes
      message: 'Too many requests from this IP, please try again later'
    });
  }

  /**
   * Strict rate limiter for task creation
   * Prevents spam
   */
  taskCreationLimiter() {
    return this.createLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 task creations per minute
      message: 'Too many tasks created, please slow down',
      keyGenerator: (req) => `create:user:${req.user?._id || this.getClientIp(req)}`
    });
  }
}

module.exports = RateLimiter;
