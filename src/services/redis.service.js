const { createClient } = require('redis');

class RedisService {
  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL
    });

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.client.connect();
  }

  // Get cached data
  async get(key) {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis GET Error:', error);
      return null;
    }
  }

  // Set data in cache with expiration
  async set(key, value, expireInSeconds = 3600) {
    try {
      await this.client.set(key, JSON.stringify(value), {
        EX: expireInSeconds
      });
    } catch (error) {
      console.error('Redis SET Error:', error);
    }
  }

  // Delete cached data
  async del(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis DEL Error:', error);
    }
  }

  // Delete multiple keys by pattern
  async delByPattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Redis DEL by Pattern Error:', error);
    }
  }

  // Generate cache key for tasks
  generateTasksCacheKey(userId) {
    return `tasks:${userId}`;
  }
}

// Create and export a singleton instance
const redisService = new RedisService();
module.exports = redisService;