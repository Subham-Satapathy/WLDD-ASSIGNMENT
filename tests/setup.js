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

// Use ioredis-mock for tests
const RedisMock = require('ioredis-mock');
const mockRedisClient = new RedisMock();

// Make redis-mock client available globally
global.__REDIS_CLIENT__ = mockRedisClient;

// Mock the ioredis module to return our redis-mock client
jest.mock('ioredis', () => require('ioredis-mock'));

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