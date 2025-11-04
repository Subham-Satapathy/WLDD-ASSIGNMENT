const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const User = require('../src/models/user.model');

let mongoServer;

const connect = async () => {
  if (mongoose.connection.readyState !== 0) {
    return;
  }
  
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
};

const closeDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
};

const clearDatabase = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
};

// Use redis-mock for tests
const redisMock = require('redis-mock');
const mockRedisClient = redisMock.createClient();
const { promisify } = require('util');

// Promisify and wrap redis-mock methods to match redis@4 interface
const originalSet = promisify(mockRedisClient.set).bind(mockRedisClient);
mockRedisClient.get = promisify(mockRedisClient.get).bind(mockRedisClient);
mockRedisClient.set = async (key, value, options) => {
  // redis-mock doesn't support options, just pass key and value
  return originalSet(key, value);
};
mockRedisClient.del = promisify(mockRedisClient.del).bind(mockRedisClient);

// Add async connect method to match real redis client
mockRedisClient.connect = async () => {};

// Make redis-mock client available globally
global.__REDIS_CLIENT__ = mockRedisClient;

// Mock the redis module to return our redis-mock client
jest.mock('redis', () => ({
  createClient: () => mockRedisClient
}));

beforeAll(async () => {
  await connect();
}, 60000);

afterAll(async () => {
  await closeDatabase();
}, 60000);

beforeEach(async () => {
  await clearDatabase();
  // Reset all mocks between tests
  jest.clearAllMocks();
});

// Create test user and generate auth token
const setupTestUser = async (email = 'test@example.com') => {
  const user = new User({
    name: 'Test User',
    email: email,
    password: 'password123'
  });
  await user.save();

  // Ensure we have a consistent JWT_SECRET for tests
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { user, token };
};

module.exports = {
  setupTestUser
};