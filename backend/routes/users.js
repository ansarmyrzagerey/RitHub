const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { auth } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// GET /api/users - Get all users
router.get('/', async (req, res) => {
  try {
    // TODO: Replace with User.findAll() or User.getAll()
    const users = await User.findAll();
    
    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// GET /api/users/profile - Get current authenticated user's profile
router.get('/profile', auth, async (req, res) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // TODO: Replace with User.findById(id)
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

// POST /api/users - Create new user (registration)
router.post('/', async (req, res) => {
  try {
    const { email, password, first_name, last_name, organization, role, username } = req.body;
    
    // Basic validation
    if (!email || !password || !first_name || !last_name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, first name, last name, and role are required'
      });
    }
    
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    // Check username uniqueness
    if (username) {
      const existingByUsername = await User.findByUsername(username);
      if (existingByUsername) {
        return res.status(409).json({ success: false, message: 'Username already exists' });
      }
    }
    
    const newUser = await User.create({
      email,
      password,
      first_name,
      last_name,
      organization,
      role,
      username
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
});

// POST /api/users/login - User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    const user = await User.authenticate(email, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Create JWT
    const token = require('jsonwebtoken').sign({ id: user.id }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful',
      user: user,
      token: token
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    // Only allow owner or admin
    if (req.user.id !== Number(id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updatedUser = await User.update(id, updateData);
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

// POST /api/users/:id/change-password - Change password
router.post('/:id/change-password', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Only owner or admin
    if (req.user.id !== Number(id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }

    // Verify current password
    const valid = await User.verifyPassword(id, currentPassword);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Check new != current
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password' });
    }

    const updated = await User.changePassword(id, newPassword);
    if (!updated) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    // Only allow owner or admin
    if (req.user.id !== Number(id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const deleted = await User.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
});

// POST /api/users/:id/delete - Delete user after verifying current password
router.post('/:id/delete', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Only allow owner or admin
    if (req.user.id !== Number(id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password required' });
    }

    // Verify the provided password
    const valid = await User.verifyPassword(id, password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Password is incorrect' });
    }

    const deleted = await User.delete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user with password:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// POST /api/users/:id/request-verification - Request email verification
router.post('/:id/request-verification', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow owner or admin
    if (req.user.id !== Number(id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.is_verified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    const result = await User.generateVerificationToken(id);
    if (!result) {
      return res.status(500).json({ success: false, message: 'Failed to generate verification token' });
    }

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${result.token}`;
    await sendVerificationEmail(user.email, verificationUrl);
    
    res.json({ 
      success: true, 
      message: 'Verification email sent',
      // Remove this in production - only for development
      ...(process.env.NODE_ENV !== 'production' && { verificationUrl })
    });
  } catch (error) {
    console.error('Error requesting verification:', error);
    res.status(500).json({ success: false, message: 'Failed to request verification' });
  }
});

// POST /api/users/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Always return success to prevent email enumeration attacks
    // But only send email if user actually exists
    const result = await User.generateTemporaryPassword(email);
    
    if (result) {
      // Send password reset email with temporary password
      const emailResult = await sendPasswordResetEmail(
        result.user.email, 
        result.tempPassword, 
        result.user.first_name
      );
      
      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        // Still return success to user to prevent enumeration
      }
    }

    // Always return success message regardless of whether user exists
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset email has been sent.'
    });

  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
});

module.exports = router;