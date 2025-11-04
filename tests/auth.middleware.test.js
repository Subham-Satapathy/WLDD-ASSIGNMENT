const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const authMiddleware = require('../src/middleware/auth');

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let mockUser;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
  });

  beforeEach(async () => {
    mockUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    await mockUser.save();

    mockReq = {
      header: jest.fn()
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should authenticate valid token', async () => {
    const token = jwt.sign(
      { userId: mockUser._id },
      process.env.JWT_SECRET || 'test-secret'
    );

    mockReq.header.mockReturnValue(`Bearer ${token}`);
    jest.spyOn(User, 'findById').mockResolvedValueOnce(mockUser);

    await authMiddleware(mockReq, mockRes, mockNext);

    expect(mockReq.user).toBeDefined();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject requests without token', async () => {
    mockReq.header.mockReturnValue(undefined);

    await authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Authentication required' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle invalid tokens', async () => {
    mockReq.header.mockReturnValue('Bearer invalid-token');

    await authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid authentication token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle user not found', async () => {
    const token = jwt.sign(
      { userId: new mongoose.Types.ObjectId() },
      process.env.JWT_SECRET || 'test-secret'
    );

    mockReq.header.mockReturnValue(`Bearer ${token}`);
    jest.spyOn(User, 'findById').mockResolvedValueOnce(null);

    await authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'User not found' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle database errors', async () => {
    const token = jwt.sign(
      { userId: mockUser._id },
      process.env.JWT_SECRET || 'test-secret'
    );

    mockReq.header.mockReturnValue(`Bearer ${token}`);
    jest.spyOn(User, 'findById').mockRejectedValueOnce(new Error('Database error'));

    await authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid authentication token' });
    expect(mockNext).not.toHaveBeenCalled();
  });
});