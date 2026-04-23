const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { sendVerificationEmail, sendWelcomeEmail } = require('../services/emailService');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, organization, role, username } = req.body;

    // Default role to 'participant' if not provided, and normalize legacy values
    let providedRole = role || 'participant';
    if (providedRole === 'user') providedRole = 'participant';

    // Normalize role: trim whitespace and convert to lowercase
    providedRole = providedRole.toString().trim().toLowerCase();

    // Validate role against allowed values
    const allowedRoles = ['researcher', 'participant', 'admin', 'reviewer'];
    if (!allowedRoles.includes(providedRole)) {
      providedRole = 'participant'; // fallback to participant
    }

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existing = await User.findByEmail(email);
    if (existing) return res.status(409).json({ success: false, message: 'Email already in use' });
    // Check username uniqueness if provided
    if (username) {
      const existingByUsername = await User.findByUsername(username);
      if (existingByUsername) return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    console.log('Creating user with role:', providedRole); // Debug log
    const newUser = await User.create({ email, password, first_name, last_name, organization, role: providedRole, username });

    // Create token
    const token = require('jsonwebtoken').sign({ id: newUser.id }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });

    res.status(201).json({ success: true, user: newUser, token });
  } catch (error) {
    console.error('Error in register:', error);
    const payload = { success: false, message: 'Registration failed' };
    if (process.env.NODE_ENV !== 'production') {
      payload.error = error.message;
      payload.stack = error.stack;
    }
    res.status(500).json(payload);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Missing credentials' });

    // Check if user exists and is suspended before attempting authentication
    // This allows us to return a specific error for suspended accounts
    const pool = require('../config/database');
    const userCheck = await pool.query('SELECT id, suspended_until FROM users WHERE email = $1 OR username = $1', [email]);
    
    if (userCheck.rows.length > 0) {
      const userRecord = userCheck.rows[0];
      // Check if account is suspended
      if (userRecord.suspended_until && new Date() < new Date(userRecord.suspended_until)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Account suspended',
          code: 'ACCOUNT_SUSPENDED',
          suspended_until: userRecord.suspended_until
        });
      }
    }

    const user = await User.authenticate(email, password);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = require('jsonwebtoken').sign({ id: user.id }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });

    res.json({ success: true, user, token });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// GET /api/auth/verify?token=...
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;

    console.log('Email verification request received for token:', token ? token.substring(0, 8) + '...' : 'null');

    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const user = await User.verifyEmail(token);

    if (!user) {
      console.log('Verification failed - no user returned');

      // Check if there are any recently verified users to provide a better error message
      const recentlyVerifiedCount = await User.getRecentlyVerifiedCount();

      if (recentlyVerifiedCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'This verification link has already been used or has expired. If you just verified your email, you can ignore this message.',
          code: 'ALREADY_USED'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token',
          code: 'INVALID_TOKEN'
        });
      }
    }

    console.log('Verification successful for user:', user.email);

    // Send welcome email after successful verification
    try {
      await sendWelcomeEmail(user.email, user.first_name);
      console.log('Welcome email sent to:', user.email);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the verification if welcome email fails
    }

    res.json({ success: true, message: 'Email verified successfully', user });
  } catch (error) {
    console.error('Error in email verification:', error);
    res.status(500).json({ success: false, message: 'Email verification failed' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.is_verified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    const result = await User.generateVerificationToken(user.id);
    if (!result) {
      return res.status(500).json({ success: false, message: 'Failed to generate verification token' });
    }

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${result.token}`;
    await sendVerificationEmail(email, verificationUrl);

    res.json({
      success: true,
      message: 'Verification email sent',
      // Remove this in production - only for development
      ...(process.env.NODE_ENV !== 'production' && { verificationUrl })
    });
  } catch (error) {
    console.error('Error in resend verification:', error);
    res.status(500).json({ success: false, message: 'Failed to resend verification email' });
  }
});

module.exports = router;
