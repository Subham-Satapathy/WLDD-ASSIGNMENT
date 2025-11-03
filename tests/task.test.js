const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { createClient } = require('redis-mock');
const Task = require('../src/models/task.model');
const redisService = require('../src/services/redis.service');
const { setupTestUser } = require('./setup');
const app = require('../src/index');

describe('Task Endpoints', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Connection is handled by setup.js
  });

  beforeEach(async () => {
    await Task.deleteMany({});
    const setup = await setupTestUser();
    authToken = setup.token;
    testUser = setup.user;
  });

  describe('GET /api/tasks', () => {
    it('should get all tasks for authenticated user', async () => {
      // Create test tasks
      await Task.create([
        {
          title: 'Test Task 1',
          description: 'Description 1',
          dueDate: new Date(),
          owner: testUser._id
        },
        {
          title: 'Test Task 2',
          description: 'Description 2',
          dueDate: new Date(),
          owner: testUser._id
        }
      ]);

      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBe(2);
      expect(res.body.find(t => t.title === 'Test Task 1')).toBeTruthy();
    });

    it('should return cached tasks if available', async () => {
      const taskId = new mongoose.Types.ObjectId();
      const cachedTasks = [
        {
          _id: taskId.toString(),
          title: 'Cached Task',
          description: 'From Cache',
          owner: testUser._id.toString()
        }
      ];

      // Set tasks in cache
      await redisService.set(
        redisService.generateTasksCacheKey(testUser._id),
        cachedTasks
      );

      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(cachedTasks);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/tasks');

      expect(res.statusCode).toBe(401);
    });

    it('should handle database errors', async () => {
      // Mock mongoose find method
      const mockFind = jest.spyOn(Task, 'find');
      mockFind.mockImplementationOnce(() => ({
        sort: () => Promise.reject(new Error('Database error'))
      }));

      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('message', 'Error fetching tasks');
      
      mockFind.mockRestore();
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      const taskData = {
        title: 'New Task',
        description: 'Task Description',
        dueDate: new Date().toISOString()
      };

      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('title', taskData.title);
      expect(res.body).toHaveProperty('owner', testUser._id.toString());
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('should invalidate cache after creating task', async () => {
      const taskData = {
        title: 'Cache Test Task',
        description: 'Description',
        dueDate: new Date().toISOString()
      };

      // Set some data in cache
      await redisService.set(
        redisService.generateTasksCacheKey(testUser._id),
        [{ title: 'Old Task' }]
      );

      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(res.statusCode).toBe(201);

      // Cache should be invalidated
      const cached = await redisService.get(
        redisService.generateTasksCacheKey(testUser._id)
      );
      expect(cached).toBeNull();
    });

    it('should handle invalid date format', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Invalid Date Task',
          description: 'Description',
          dueDate: 'not-a-date'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should handle save errors', async () => {
      jest.spyOn(Task.prototype, 'save').mockRejectedValueOnce(new Error('Save failed'));

      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Error Task',
          description: 'Description',
          dueDate: new Date().toISOString()
        });

      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('message', 'Error creating task');
    });
  });

  describe('PUT /api/tasks/:id', () => {
    let taskId;

    beforeEach(async () => {
      const task = await Task.create({
        title: 'Test Task',
        description: 'Description',
        dueDate: new Date(),
        owner: testUser._id
      });
      taskId = task._id;
    });

    it('should update task', async () => {
      const updateData = {
        title: 'Updated Task',
        status: 'completed',
        dueDate: new Date().toISOString()
      };

      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('title', updateData.title);
      expect(res.body).toHaveProperty('status', updateData.status);
    });

    it('should invalidate cache after updating task', async () => {
      // Set some data in cache
      await redisService.set(
        redisService.generateTasksCacheKey(testUser._id),
        [{ title: 'Old Task' }]
      );

      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Task' });

      expect(res.statusCode).toBe(200);

      // Cache should be invalidated
      const cached = await redisService.get(
        redisService.generateTasksCacheKey(testUser._id)
      );
      expect(cached).toBeNull();
    });

    it('should not update task of another user', async () => {
      const otherUser = await setupTestUser('other@example.com');
      const otherTask = await Task.create({
        title: 'Other Task',
        description: 'Description',
        dueDate: new Date(),
        owner: otherUser.user._id
      });

      const res = await request(app)
        .put(`/api/tasks/${otherTask._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Task' });

      expect(res.statusCode).toBe(404);
    });

    it('should handle invalid task ID format', async () => {
      const res = await request(app)
        .put('/api/tasks/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Task' });

      expect(res.statusCode).toBe(500);
    });

    it('should reject invalid update fields', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalidField: 'value' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid updates');
    });

    it('should handle non-existent task', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/tasks/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Task' });

      expect(res.statusCode).toBe(404);
    });

    it('should handle invalid status value', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid-status' });

      expect(res.statusCode).toBe(400);
    });

    it('should handle invalid date format in update', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ dueDate: 'not-a-date' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    let taskId;

    beforeEach(async () => {
      const task = await Task.create({
        title: 'Test Task',
        description: 'Description',
        dueDate: new Date(),
        owner: testUser._id
      });
      taskId = task._id;
    });

    it('should delete task', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      
      const task = await Task.findById(taskId);
      expect(task).toBeNull();
    });

    it('should not delete task of another user', async () => {
      const otherUser = await setupTestUser('another@example.com');
      const otherTask = await Task.create({
        title: 'Other Task',
        description: 'Description',
        dueDate: new Date(),
        owner: otherUser.user._id
      });

      const res = await request(app)
        .delete(`/api/tasks/${otherTask._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      
      const task = await Task.findById(otherTask._id);
      expect(task).not.toBeNull();
    });
  });

  describe('GET /api/tasks/filter', () => {
    beforeEach(async () => {
      // Create test tasks with different statuses and due dates
      await Task.create([
        {
          title: 'Pending Task 1',
          description: 'Description',
          status: 'pending',
          dueDate: new Date('2025-12-01'),
          owner: testUser._id
        },
        {
          title: 'Completed Task',
          description: 'Description',
          status: 'completed',
          dueDate: new Date('2025-11-01'),
          owner: testUser._id
        },
        {
          title: 'Pending Task 2',
          description: 'Description',
          status: 'pending',
          dueDate: new Date('2025-10-01'),
          owner: testUser._id
        }
      ]);
    });

    it('should filter tasks by status', async () => {
      const res = await request(app)
        .get('/api/tasks/filter')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBe(2);
      expect(res.body.every(task => task.status === 'pending')).toBeTruthy();
    });

    it('should filter tasks by due date', async () => {
      const res = await request(app)
        .get('/api/tasks/filter')
        .query({ dueDate: '2025-11-15' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      // Should only include tasks due before Nov 15
      expect(res.body.length).toBe(2);
      expect(res.body.every(task => new Date(task.dueDate) <= new Date('2025-11-15'))).toBeTruthy();
    });

    it('should combine status and due date filters', async () => {
      const res = await request(app)
        .get('/api/tasks/filter')
        .query({
          status: 'pending',
          dueDate: '2025-11-15'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBe(1);
      expect(res.body[0].status).toBe('pending');
      expect(new Date(res.body[0].dueDate).getTime())
        .toBeLessThanOrEqual(new Date('2025-11-15').getTime());
    });

    it('should handle invalid date format in filter', async () => {
      const res = await request(app)
        .get('/api/tasks/filter')
        .query({ dueDate: 'not-a-date' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(500);
    });

    it('should handle invalid status in filter', async () => {
      const res = await request(app)
        .get('/api/tasks/filter')
        .query({ status: 'invalid-status' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should handle database errors', async () => {
      const mockFind = jest.spyOn(Task, 'find');
      mockFind.mockImplementationOnce(() => ({
        sort: () => Promise.reject(new Error('Database error'))
      }));

      const res = await request(app)
        .get('/api/tasks/filter')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('message', 'Error fetching tasks');
    });
  });
});