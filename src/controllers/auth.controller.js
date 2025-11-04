const { validationResult } = require('express-validator');
const authService = require('../services/auth.service');

exports.signup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { user, token } = await authService.signup(req.body);
    res.status(201).json({ user, token });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ 
      message: error.statusCode ? error.message : 'Error creating user',
      error: error.message 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const { user, token } = await authService.login(email, password);
    
    res.json({ user, token });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ 
      message: error.statusCode ? error.message : 'Error logging in',
      error: error.message 
    });
  }
};