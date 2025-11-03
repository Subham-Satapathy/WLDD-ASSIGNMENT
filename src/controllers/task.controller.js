const { validationResult } = require('express-validator');
const taskService = require('../services/task.service');

/**
 * Get all tasks for the logged-in user
 */
exports.getTasks = async (req, res) => {
  try {
    const tasks = await taskService.getTasks(req.user._id);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks', error: error.message });
  }
};

/**
 * Create a new task
 */
exports.createTask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await taskService.createTask(req.body, req.user._id);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Error creating task', error: error.message });
  }
};

/**
 * Update a task
 */
exports.updateTask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await taskService.updateTask(req.params.id, req.body, req.user._id);
    res.json(task);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ 
      message: error.statusCode ? error.message : 'Error updating task',
      error: error.message 
    });
  }
};

/**
 * Delete a task
 */
exports.deleteTask = async (req, res) => {
  try {
    const task = await taskService.deleteTask(req.params.id, req.user._id);
    res.json({ message: 'Task deleted successfully', task });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ 
      message: error.statusCode ? error.message : 'Error deleting task',
      error: error.message 
    });
  }
};

/**
 * Get filtered tasks
 */
exports.getFilteredTasks = async (req, res) => {
  try {
    const tasks = await taskService.getFilteredTasks(req.query, req.user._id);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks', error: error.message });
  }
};