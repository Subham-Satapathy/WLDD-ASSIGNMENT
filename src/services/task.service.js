const Task = require("../models/task.model");
const redisService = require("./redis.service");
const { 
  AppError,
  ValidationError,
  NotFoundError,
  DatabaseError
} = require("../utils/errors");

class TaskService {
  async getTasks(userId) {
    try {
      const cacheKey = redisService.generateTasksCacheKey(userId);
      const cachedTasks = await redisService.get(cacheKey);

      if (cachedTasks) {
        return cachedTasks;
      }

      const tasks = await Task.find({ owner: userId }).sort({ createdAt: -1 });
      await redisService.set(cacheKey, tasks, 3600);
      return tasks;
    } catch (error) {
      throw new DatabaseError("Error fetching tasks");
    }
  }

  async createTask(taskData, userId) {
    try {
      const dueDate = new Date(taskData.dueDate);
      if (isNaN(dueDate.getTime())) {
        const valError = new ValidationError("Invalid due date format", [
          { field: "dueDate", message: "Date format is invalid" }
        ]);
        valError.statusCode = 400;
        throw valError;
      }

      // Check for exact duplicate first
      const exactDuplicate = await Task.findOne({
        owner: userId,
        title: taskData.title,
        description: taskData.description || null,
        dueDate: dueDate,
        status: taskData.status || 'pending'
      });

      if (exactDuplicate) {
        const error = new AppError("Duplicate task found", 409, "DUPLICATE_TASK");
        error.details = {
          existingTaskId: exactDuplicate._id,
          duplicateReason: "Exact task match"
        };
        throw error;
      }

      // Check for tasks with same title in 24 hour window
      const similarTask = await Task.findOne({
        owner: userId,
        title: taskData.title,
        dueDate: {
          $gte: new Date(dueDate.getTime() - 24 * 60 * 60 * 1000),
          $lte: new Date(dueDate.getTime() + 24 * 60 * 60 * 1000)
        },
        status: "pending"
      });

      if (similarTask && similarTask._id.toString() !== exactDuplicate?._id.toString()) {
        const error = new AppError("Similar task exists", 409, "DUPLICATE_TASK");
        error.details = {
          existingTaskId: similarTask._id,
          duplicateReason: "Same title and timeframe"
        };
        throw error;
      }

      const task = new Task({
        title: taskData.title,
        description: taskData.description,
        dueDate: dueDate,
        status: taskData.status || 'pending',
        owner: userId
      });

      await task.save();
      await this.invalidateUserCache(userId);
      return task;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error.name === "ValidationError") {
        const valError = new ValidationError("Invalid input", 
          Object.keys(error.errors).map(field => ({
            field,
            message: error.errors[field].message
          }))
        );
        valError.statusCode = 400;
        throw valError;
      }
      throw new DatabaseError("Error creating task");
    }
  }

  async updateTask(taskId, updates, userId) {
    try {
      const allowedUpdates = ["title", "description", "status", "dueDate"];
      const isValidOperation = Object.keys(updates).every(update => allowedUpdates.includes(update));

      if (!isValidOperation) {
        const valError = new ValidationError("Invalid updates", [
          { field: "updates", message: "Contains invalid update fields" }
        ]);
        valError.statusCode = 400;
        throw valError;
      }

      let task;
      try {
        task = await Task.findOne({ _id: taskId, owner: userId });
      } catch (error) {
        if (error.name === "CastError") {
          const valError = new ValidationError("Invalid task ID format");
          valError.statusCode = 400;
          throw valError;
        }
        throw new DatabaseError("Error updating task");
      }

      if (!task) {
        throw new NotFoundError("Task not found");
      }

      // Validate due date if it's being updated
      if (updates.dueDate) {
        const dueDate = new Date(updates.dueDate);
        if (isNaN(dueDate.getTime())) {
          const valError = new ValidationError("Invalid due date format", [
            { field: "dueDate", message: "Date format is invalid" }
          ]);
          valError.statusCode = 400;
          throw valError;
        }
        updates.dueDate = dueDate;
      }

      Object.assign(task, updates);
      await task.save();
      await this.invalidateUserCache(userId);
      return task;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error.name === "ValidationError") {
        const valError = new ValidationError("Invalid input", 
          Object.keys(error.errors).map(field => ({
            field,
            message: error.errors[field].message
          }))
        );
        valError.statusCode = 400;
        throw valError;
      }
      throw error;
    }
  }

  async deleteTask(taskId, userId) {
    try {
      const task = await Task.findOneAndDelete({ _id: taskId, owner: userId });
      if (!task) {
        throw new NotFoundError("Task not found");
      }
      await this.invalidateUserCache(userId);
      return task;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error.name === "CastError") {
        const valError = new ValidationError("Invalid task ID format");
        valError.statusCode = 400;
        throw valError;
      }
      throw new DatabaseError("Error deleting task");
    }
  }

  async getFilteredTasks(filters, userId) {
    try {
      const match = { owner: userId };

      if (filters.status) {
        if (!['pending', 'completed'].includes(filters.status)) {
          return [];
        }
        match.status = filters.status;
      }

      if (filters.dueDate) {
        const dueDate = new Date(filters.dueDate);
        if (isNaN(dueDate.getTime())) {
          const valError = new ValidationError("Invalid due date format", [
            { field: "dueDate", message: "Date format is invalid" }
          ]);
          valError.statusCode = 400;
          throw valError;
        }
        match.dueDate = { $lte: dueDate };
      }

      const tasks = await Task.find(match).sort({ createdAt: -1 });
      return tasks;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new DatabaseError("Error fetching tasks");
    }
  }

  async invalidateUserCache(userId) {
    await redisService.del(redisService.generateTasksCacheKey(userId));
  }
}

module.exports = new TaskService();
