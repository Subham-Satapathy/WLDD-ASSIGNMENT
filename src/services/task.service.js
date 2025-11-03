const Task = require('../models/task.model');
const redisService = require('./redis.service');

class TaskService {
  /**
   * Get all tasks for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of tasks
   */
  async getTasks(userId) {
    // Try to get tasks from cache first
    const cacheKey = redisService.generateTasksCacheKey(userId);
    const cachedTasks = await redisService.get(cacheKey);

    if (cachedTasks) {
      return cachedTasks;
    }

    // If not in cache, fetch from database
    const tasks = await Task.find({ owner: userId })
      .sort({ createdAt: -1 });

    // Store in cache for 1 hour
    await redisService.set(cacheKey, tasks, 3600);

    return tasks;
  }

  /**
   * Create a new task
   * @param {Object} taskData - Task data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created task
   */
  async createTask(taskData, userId) {
    const task = new Task({
      ...taskData,
      owner: userId
    });

    await task.save();
    
    // Invalidate tasks cache for this user
    await this.invalidateUserCache(userId);
    
    return task;
  }

  /**
   * Update a task
   * @param {string} taskId - Task ID
   * @param {Object} updates - Fields to update
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated task
   */
  async updateTask(taskId, updates, userId) {
    // Validate update fields
    const allowedUpdates = ['title', 'description', 'status', 'dueDate'];
    const isValidOperation = Object.keys(updates)
      .every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      const error = new Error('Invalid updates');
      error.statusCode = 400;
      throw error;
    }

    const task = await Task.findOne({ _id: taskId, owner: userId });

    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    Object.assign(task, updates);
    await task.save();
    
    // Invalidate tasks cache for this user
    await this.invalidateUserCache(userId);
    
    return task;
  }

  /**
   * Delete a task
   * @param {string} taskId - Task ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deleted task
   */
  async deleteTask(taskId, userId) {
    const task = await Task.findOneAndDelete({ _id: taskId, owner: userId });

    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    // Invalidate tasks cache for this user
    await this.invalidateUserCache(userId);

    return task;
  }

  /**
   * Get filtered tasks
   * @param {Object} filters - Filter criteria
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Filtered tasks
   */
  async getFilteredTasks(filters, userId) {
    const match = { owner: userId };
    
    if (filters.status) {
      match.status = filters.status;
    }
    
    if (filters.dueDate) {
      match.dueDate = { $lte: new Date(filters.dueDate) };
    }

    return Task.find(match).sort({ createdAt: -1 });
  }

  /**
   * Invalidate user's tasks cache
   * @param {string} userId - User ID
   */
  async invalidateUserCache(userId) {
    await redisService.del(redisService.generateTasksCacheKey(userId));
  }
}

module.exports = new TaskService();