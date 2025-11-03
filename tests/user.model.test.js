const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/user.model');

describe('User Model', () => {
  it('should hash password before saving', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    };

    const user = new User(userData);
    await user.save();

    expect(user.password).not.toBe(userData.password);
    expect(await bcrypt.compare(userData.password, user.password)).toBeTruthy();
  });

  it('should not rehash password if it was not modified', async () => {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });

    await user.save();
    const hashedPassword = user.password;

    user.name = 'Updated Name';
    await user.save();

    expect(user.password).toBe(hashedPassword);
  });

  it('should handle password hashing errors', async () => {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });

    // Mock bcrypt.genSalt to throw an error
    jest.spyOn(bcrypt, 'genSalt').mockRejectedValueOnce(new Error('Hashing error'));

    await expect(user.save()).rejects.toThrow('Hashing error');
  });

  it('should remove password when converting to JSON', async () => {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });

    const userJson = user.toJSON();
    expect(userJson.password).toBeUndefined();
  });

  it('should validate email format', async () => {
    const user = new User({
      name: 'Test User',
      email: 'invalid-email',
      password: 'password123'
    });

    await expect(user.validate()).rejects.toThrow('Please enter a valid email');
  });
});