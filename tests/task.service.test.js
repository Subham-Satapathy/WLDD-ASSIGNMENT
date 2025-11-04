const mongoose = require('mongoose');
const Task = require('../src/models/task.model');
const taskService = require('../src/services/task.service');
const redisService = require('../src/services/redis.service');

describe('Task Service', () => {
  let userId;
  let testTask;

  beforeEach(async () => {
    await Task.deleteMany({});
    userId = new mongoose.Types.ObjectId();

    testTask = await Task.create({
      title: 'Test Task',
      description: 'Test Description',
      status: 'pending',
      dueDate: new Date('2025-12-31'),
      owner: userId
    });
  });

  describe('getTasks', () => {
    it('should return tasks from cache if available', async () => {
      const cachedTasks = [{ id: 'cached-task' }];
      await redisService.set(
        redisService.generateTasksCacheKey(userId),
        cachedTasks
      );

      const result = await taskService.getTasks(userId);
      expect(result).toEqual(cachedTasks);
    });

    it('should fetch from database if cache miss', async () => {
      const tasks = await taskService.getTasks(userId);
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe(testTask.title);
    });

    it('should cache database results', async () => {
      await taskService.getTasks(userId);

      const cached = await redisService.get(
        redisService.generateTasksCacheKey(userId)
      );
      expect(cached).toBeDefined();
      expect(cached[0].title).toBe(testTask.title);
    });
  });

  describe('createTask', () => {
    const newTaskData = {
      title: 'New Task',
      description: 'New Description',
      status: 'pending',
      dueDate: new Date('2025-12-31')
    };

    it('should create new task', async () => {
      const task = await taskService.createTask(newTaskData, userId);

      expect(task.title).toBe(newTaskData.title);
      expect(task.owner.toString()).toBe(userId.toString());
    });

    it('should invalidate user cache after creation', async () => {
      // Set some data in cache
      await redisService.set(
        redisService.generateTasksCacheKey(userId),
        [testTask]
      );

      await taskService.createTask(newTaskData, userId);

      // Cache should be invalidated
      const cached = await redisService.get(
        redisService.generateTasksCacheKey(userId)
      );
      expect(cached).toBeNull();
    });

    it('should validate required fields', async () => {
      await expect(taskService.createTask({}, userId))
        .rejects
        .toThrow();
    });
  });

  describe('updateTask', () => {
    it('should update task fields', async () => {
      const updates = {
        title: 'Updated Title',
        status: 'completed'
      };

      const task = await taskService.updateTask(testTask._id, updates, userId);

      expect(task.title).toBe(updates.title);
      expect(task.status).toBe(updates.status);
      expect(task.description).toBe(testTask.description); // Unchanged field
    });

    it('should throw error for non-existent task', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await expect(taskService.updateTask(nonExistentId, { title: 'New' }, userId))
        .rejects
        .toThrow('Task not found');
    });

    it('should not update task of different user', async () => {
      const differentUserId = new mongoose.Types.ObjectId();
      
      await expect(taskService.updateTask(testTask._id, { title: 'New' }, differentUserId))
        .rejects
        .toThrow('Task not found');
    });

    it('should reject invalid update fields', async () => {
      await expect(taskService.updateTask(testTask._id, { invalid: 'field' }, userId))
        .rejects
        .toThrow('Invalid updates');
    });

    it('should invalidate cache after update', async () => {
      await redisService.set(
        redisService.generateTasksCacheKey(userId),
        [testTask]
      );

      await taskService.updateTask(testTask._id, { title: 'Updated' }, userId);

      const cached = await redisService.get(
        redisService.generateTasksCacheKey(userId)
      );
      expect(cached).toBeNull();
    });
  });

  describe('deleteTask', () => {
    it('should delete existing task', async () => {
      const task = await taskService.deleteTask(testTask._id, userId);
      expect(task._id.toString()).toBe(testTask._id.toString());

      const found = await Task.findById(testTask._id);
      expect(found).toBeNull();
    });

    it('should throw error for non-existent task', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await expect(taskService.deleteTask(nonExistentId, userId))
        .rejects
        .toThrow('Task not found');
    });

    it('should not delete task of different user', async () => {
      const differentUserId = new mongoose.Types.ObjectId();
      
      await expect(taskService.deleteTask(testTask._id, differentUserId))
        .rejects
        .toThrow('Task not found');
    });

    it('should invalidate cache after deletion', async () => {
      await redisService.set(
        redisService.generateTasksCacheKey(userId),
        [testTask]
      );

      await taskService.deleteTask(testTask._id, userId);

      const cached = await redisService.get(
        redisService.generateTasksCacheKey(userId)
      );
      expect(cached).toBeNull();
    });
  });

  describe('getFilteredTasks', () => {
    beforeEach(async () => {
      await Task.create([
        {
          title: 'Pending Task',
          status: 'pending',
          dueDate: new Date('2025-11-15'),
          owner: userId
        },
        {
          title: 'Completed Task',
          status: 'completed',
          dueDate: new Date('2025-10-15'),
          owner: userId
        }
      ]);
    });

    it('should filter by status', async () => {
      const tasks = await taskService.getFilteredTasks({ status: 'pending' }, userId);
      
      expect(tasks).toHaveLength(2); // Including the test task
      expect(tasks.every(t => t.status === 'pending')).toBe(true);
    });

    it('should filter by due date', async () => {
      const tasks = await taskService.getFilteredTasks(
        { dueDate: '2025-11-01' },
        userId
      );

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Completed Task');
    });

    it('should combine filters', async () => {
      const tasks = await taskService.getFilteredTasks(
        { 
          status: 'pending',
          dueDate: '2025-12-01'
        },
        userId
      );

      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('pending');
      expect(new Date(tasks[0].dueDate).getTime()).toBeLessThanOrEqual(new Date('2025-12-01').getTime());
    });

    it('should only return tasks for specified user', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      await Task.create({
        title: 'Other User Task',
        status: 'pending',
        owner: otherUserId,
        dueDate: new Date('2025-11-15')
      });

      const tasks = await taskService.getFilteredTasks({}, userId);
      expect(tasks.every(t => t.owner.toString() === userId.toString())).toBe(true);
    });
  });
});