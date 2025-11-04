const { validationResult } = require('express-validator');
const taskService = require('../services/task.service');
const { ValidationError, NotFoundError } = require('../utils/errors');

exports.getTasks = async (req, res, next) => {
  try {
    const tasks = await taskService.getTasks(req.user._id);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

exports.createTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid input', errors.array());
    }

    const task = await taskService.createTask(req.body, req.user._id);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid input', errors.array());
    }

    const task = await taskService.updateTask(req.params.id, req.body, req.user._id);
    if (!task) {
      throw new NotFoundError('Task not found');
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const task = await taskService.deleteTask(req.params.id, req.user._id);
    if (!task) {
      throw new NotFoundError('Task not found');
    }
    res.json({ message: 'Task deleted successfully', task });
  } catch (error) {
    next(error);
  }
};

exports.getFilteredTasks = async (req, res, next) => {
  try {
    const tasks = await taskService.getFilteredTasks(req.query, req.user._id);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
};