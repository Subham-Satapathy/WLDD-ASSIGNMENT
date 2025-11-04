const RateLimiter = require('../src/middleware/rateLimiter');
const { RateLimitError } = require('../src/utils/errors');

describe('Rate Limiter', () => {
  let mockRedisClient;
  let rateLimiter;
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    // Mock Redis client (ioredis API)
    mockRedisClient = {
      status: 'ready',
      zremrangebyscore: jest.fn().mockResolvedValue(1),
      zcard: jest.fn().mockResolvedValue(0),
      zrange: jest.fn().mockResolvedValue([]),
      zadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      zrem: jest.fn().mockResolvedValue(1)
    };

    rateLimiter = new RateLimiter(mockRedisClient);

    mockRequest = {
      ip: '127.0.0.1',
      headers: {},
      body: {},
      user: null,
      app: {
        get: jest.fn().mockReturnValue(mockRedisClient)
      }
    };

    mockResponse = {
      set: jest.fn(),
      send: jest.fn(),
      statusCode: 200
    };

    nextFunction = jest.fn();
  });

  describe('createLimiter', () => {
    it('should allow requests within rate limit', async () => {
      mockRedisClient.zcard.mockResolvedValue(5); // 5 requests so far

      const limiter = rateLimiter.createLimiter({ max: 10, windowMs: 60000 });
      await limiter(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
    });

    it('should block requests exceeding rate limit', async () => {
      mockRedisClient.zcard.mockResolvedValue(10); // Already at limit
      mockRedisClient.zrange.mockResolvedValue([
        'request1', String(Date.now() - 50000) // [value, score]
      ]);

      const limiter = rateLimiter.createLimiter({ max: 10, windowMs: 60000 });
      await limiter(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(expect.any(RateLimitError));
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
      expect(mockResponse.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });

    it('should use custom key generator', async () => {
      mockRequest.user = { _id: 'user123' };
      mockRedisClient.zcard.mockResolvedValue(0);

      const keyGenerator = jest.fn((req) => `custom:${req.user._id}`);
      const limiter = rateLimiter.createLimiter({ 
        max: 10, 
        windowMs: 60000,
        keyGenerator 
      });
      
      await limiter(mockRequest, mockResponse, nextFunction);

      expect(keyGenerator).toHaveBeenCalledWith(mockRequest);
      expect(mockRedisClient.zremrangebyscore).toHaveBeenCalledWith(
        expect.stringContaining('custom:user123'),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should skip rate limiting if Redis is not available', async () => {
      mockRedisClient.status = 'disconnected';

      const limiter = rateLimiter.createLimiter({ max: 10, windowMs: 60000 });
      await limiter(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockRedisClient.zcard).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.zcard.mockRejectedValue(new Error('Redis error'));

      const limiter = rateLimiter.createLimiter({ max: 10, windowMs: 60000 });
      await limiter(mockRequest, mockResponse, nextFunction);

      // Should not block request on error
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should set correct rate limit headers', async () => {
      mockRedisClient.zcard.mockResolvedValue(3);

      const limiter = rateLimiter.createLimiter({ max: 10, windowMs: 60000 });
      await limiter(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Remaining', 6);
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from x-forwarded-for header', () => {
      mockRequest.headers['x-forwarded-for'] = '192.168.1.1, 10.0.0.1';
      const ip = rateLimiter.getClientIp(mockRequest);
      expect(ip).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      mockRequest.headers['x-real-ip'] = '192.168.1.2';
      const ip = rateLimiter.getClientIp(mockRequest);
      expect(ip).toBe('192.168.1.2');
    });

    it('should use req.ip as fallback', () => {
      mockRequest.ip = '192.168.1.3';
      const ip = rateLimiter.getClientIp(mockRequest);
      expect(ip).toBe('192.168.1.3');
    });

    it('should return unknown if no IP found', () => {
      delete mockRequest.ip;
      const ip = rateLimiter.getClientIp(mockRequest);
      expect(ip).toBe('unknown');
    });
  });

  describe('authLimiter', () => {
    it('should create strict rate limiter for auth', async () => {
      mockRedisClient.zcard.mockResolvedValue(0);
      mockRequest.body = { email: 'test@example.com' };

      const limiter = rateLimiter.authLimiter();
      await limiter(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockRedisClient.zremrangebyscore).toHaveBeenCalledWith(
        expect.stringContaining('auth:'),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should block after 5 auth attempts', async () => {
      mockRedisClient.zcard.mockResolvedValue(5);
      mockRedisClient.zrange.mockResolvedValue([
        'request1', String(Date.now() - 60000)
      ]);
      mockRequest.body = { email: 'test@example.com' };

      const limiter = rateLimiter.authLimiter();
      await limiter(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(expect.any(RateLimitError));
    });
  });

  describe('apiLimiter', () => {
    it('should create moderate rate limiter for API', async () => {
      mockRedisClient.zcard.mockResolvedValue(50);

      const limiter = rateLimiter.apiLimiter();
      await limiter(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
    });
  });

  describe('limit', () => {
    it('should create simple rate limiter with custom values', async () => {
      mockRedisClient.zcard.mockResolvedValue(5);

      const limiter = rateLimiter.limit(20, 30000);
      await limiter(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Limit', 20);
    });
  });
});
