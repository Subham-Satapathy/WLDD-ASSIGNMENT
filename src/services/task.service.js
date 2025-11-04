const Task = require('../models/task.model');
const redisService = require('./redis.service');

class TaskService {
  /**
   * Get all tasks for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of tasks
   */
  async getTasks(userId) {
    try {
      const cacheKey = redisService.generateTasksCacheKey(userId);
      const cachedTasks = await redisService.get(cacheKey);

      if (cachedTasks) {
        return cachedTasks;
      }

      const tasks = await Task.find({ owner: userId })
        .sort({ createdAt: -1 });
      await redisService.set(cacheKey, tasks, 3600);

      return tasks;
    } catch (error) {
      throw new Error('Error fetching tasks');
    }
  }

  /**
   * Create a new task
   * @param {Object} taskData - Task data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created task
   */
  async createTask(taskData, userId) {
    const dueDate = new Date(taskData.dueDate);
    if (isNaN(dueDate.getTime())) {
      throw new Error('Invalid due date format');
    }
    const duplicateQuery = {
      owner: userId,
      title: taskData.title,
      $or: [
        // Exact title and description match
        {
          description: taskData.description || null,
          dueDate: dueDate
        },
        // Same title, due date within 24 hours, and pending status
        {
          dueDate: {
            $gte: new Date(dueDate.getTime() - 24 * 60 * 60 * 1000),
            $lte: new Date(dueDate.getTime() + 24 * 60 * 60 * 1000)
          },
          status: 'pending'
        }
      ]
    };

    const existingTask = await Task.findOne(duplicateQuery);

    if (existingTask) {
      const error = new Error('A similar task already exists');
      error.details = {
        existingTaskId: existingTask._id,
        duplicateReason: existingTask.title === taskData.title ? 
          'Same title and timeframe' : 'Exact task match'
      };
      error.statusCode = 409; // Conflict
      throw error;
    }

    const task = new Task({
      ...taskData,
      owner: userId
    });

    try {
      await task.save();
      
      // Invalidate tasks cache for this user
      await this.invalidateUserCache(userId);
      
      return task;
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw error; // Let validation errors through
      }
      throw new Error('Error creating task');
    }
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

    let task;
    try {
      task = await Task.findOne({ _id: taskId, owner: userId });

      if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
      }
    } catch (error) {
      if (error.name === 'CastError') {
        throw new Error('Invalid updates');
      }
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
    try {
      const match = { owner: userId };
      
      if (filters.status) {
        match.status = filters.status;
      }
      
      if (filters.dueDate) {
        match.dueDate = { $lte: new Date(filters.dueDate) };
      }

      return await Task.find(match).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error('Error fetching tasks');
    }
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