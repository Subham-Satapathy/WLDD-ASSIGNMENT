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
      const formattedErrors = errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }));
      throw new ValidationError('Validation Error', formattedErrors);
    }

    const task = await taskService.createTask(req.body, req.user._id);
    res.status(201).json(task);
  } catch (error) {
    if (error.statusCode === 409) {
      error.statusCode = 409;
    } else if (error.name === 'ValidationError') {
      error.statusCode = 400;
    } else if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid updates', errors.array());
    }

    const task = await taskService.updateTask(req.params.id, req.body, req.user._id);
    if (!task) {
      throw new NotFoundError('Task not found');
    }
    res.status(200).json(task);
  } catch (error) {
    if (error.name === 'CastError') {
      error.statusCode = 400;
    }
    if (error.name === 'ValidationError' && error.message !== 'Invalid updates') {
      error.statusCode = 400;
      error.message = 'Invalid updates';
    }
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