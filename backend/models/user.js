const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SALT_ROUNDS = 10;

// Helper to remove sensitive fields
function sanitize(user) {
  if (!user) return null;
  const { password_hash, verification_token, verification_token_expires, ...rest } = user;
  return rest;
}

// Helper to check if user is suspended
function isSuspended(user) {
  if (!user || !user.suspended_until) return false;
  return new Date() < new Date(user.suspended_until);
}

const User = {
  async findByEmail(email) {
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0] ? sanitize(res.rows[0]) : null;
  },

  async findByUsername(username) {
    const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return res.rows[0] ? sanitize(res.rows[0]) : null;
  },

  async findById(id) {
    const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] ? sanitize(res.rows[0]) : null;
  },

  async findAll() {
    const res = await pool.query('SELECT id, email, username, first_name, last_name, organization, role, created_at, updated_at FROM users');
    return res.rows;
  },

  async create({ email, password, first_name, last_name, organization, role, username }) {
    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const res = await pool.query(
      `INSERT INTO users (email, username, password_hash, first_name, last_name, organization, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, email, username, first_name, last_name, organization, role, created_at, updated_at`,
      [email, username || null, password_hash, first_name, last_name, organization || null, role]
    );

    return res.rows[0];
  },

  async authenticate(identifier, password) {
    // Allow login by email or username
    const res = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $1', [identifier]);
    const user = res.rows[0];
    if (!user) return null;

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return null;

    // Check if temporary password is expired
    if (user.temp_password_expires && new Date() > new Date(user.temp_password_expires)) {
      return null; // Temporary password expired
    }

    // Check if account is suspended
    if (user.suspended_until && new Date() < new Date(user.suspended_until)) {
      return null; // Account is suspended
    }

    // Sanitize before returning
    return sanitize(user);
  },

  async update(id, updateData) {
    // Build SET clause dynamically
    const allowed = ['email', 'username', 'password', 'first_name', 'last_name', 'organization', 'role'];
    const fields = [];
    const values = [];
    let idx = 1;

    if (updateData.password) {
      // Hash the new password
      const password_hash = await bcrypt.hash(updateData.password, SALT_ROUNDS);
      fields.push(`password_hash = $${idx++}`);
      values.push(password_hash);
    }

    for (const key of allowed) {
      if (key === 'password') continue; // handled above
      if (updateData[key] !== undefined && key !== 'password') {
        fields.push(`${key} = $${idx++}`);
        values.push(updateData[key]);
      }
    }

    if (fields.length === 0) return await this.findById(id);

    // add updated_at
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, email, username, first_name, last_name, organization, role, created_at, updated_at`;
    values.push(id);

    const res = await pool.query(query, values);
    return res.rows[0] ? sanitize(res.rows[0]) : null;
  },

  async delete(id) {
    const res = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    return res.rowCount > 0;
  },
  // Verify a plaintext password against stored hash for a user id
  async verifyPassword(id, password) {
    const res = await pool.query('SELECT password_hash FROM users WHERE id = $1', [id]);
    const row = res.rows[0];
    if (!row) return false;
    return await bcrypt.compare(password, row.password_hash);
  },

  // Change the password for a user (hashes the new password)
  async changePassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const res = await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, username, first_name, last_name, organization, role, created_at, updated_at`,
      [password_hash, id]
    );
    return res.rows[0] ? sanitize(res.rows[0]) : null;
  },

  // Generate email verification token
  async generateVerificationToken(id) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    const res = await pool.query(
      `UPDATE users SET verification_token = $1, verification_token_expires = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 RETURNING id, email, username, first_name, last_name, organization, role, is_verified, created_at, updated_at`,
      [token, expires, id]
    );
    
    return res.rows[0] ? { user: sanitize(res.rows[0]), token } : null;
  },

  // Verify email with token
  async verifyEmail(token) {
    // First, check if we have a user with this token (regardless of expiration)
    const userRes = await pool.query(
      `SELECT id, email, username, first_name, last_name, organization, role, is_verified, 
              verification_token_expires, created_at, updated_at
       FROM users WHERE verification_token = $1`,
      [token]
    );
    
    if (!userRes.rows[0]) {
      console.log('No user found with token:', token);
      
      // Check if this token was recently used (user might be already verified)
      // We'll look for recently verified users (within last 24 hours) as a fallback
      const recentlyVerifiedRes = await pool.query(
        `SELECT id, email, username, first_name, last_name, organization, role, is_verified, 
                created_at, updated_at
         FROM users 
         WHERE is_verified = true 
         AND updated_at > NOW() - INTERVAL '24 hours'
         ORDER BY updated_at DESC
         LIMIT 5`
      );
      
      // If we have recently verified users, we can't be sure which one this token belonged to
      // So we'll still return null, but this gives us insight for debugging
      console.log('Recently verified users:', recentlyVerifiedRes.rows.length);
      return null;
    }

    const user = userRes.rows[0];
    
    // If user is already verified, return success (don't show error for already verified)
    if (user.is_verified) {
      console.log('User already verified:', user.email);
      return sanitize(user);
    }

    // Check if token is expired
    if (user.verification_token_expires && new Date() > new Date(user.verification_token_expires)) {
      console.log('Token expired for user:', user.email);
      return null;
    }

    // Update user to verified and clear token
    const updateRes = await pool.query(
      `UPDATE users SET is_verified = true, verification_token = NULL, verification_token_expires = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, email, username, first_name, last_name, organization, role, is_verified, created_at, updated_at`,
      [user.id]
    );
    
    console.log('Email verified successfully for user:', user.email);
    return updateRes.rows[0] ? sanitize(updateRes.rows[0]) : null;
  },

  // Check if user needs email verification
  async needsEmailVerification(id) {
    const res = await pool.query('SELECT is_verified FROM users WHERE id = $1', [id]);
    return res.rows[0] ? !res.rows[0].is_verified : false;
  },

  // Get count of recently verified users (for better error messages)
  async getRecentlyVerifiedCount() {
    const res = await pool.query(
      `SELECT COUNT(*) as count FROM users 
       WHERE is_verified = true 
       AND updated_at > NOW() - INTERVAL '1 hour'`
    );
    return parseInt(res.rows[0].count);
  },

  // Generate temporary password for password reset
  async generateTemporaryPassword(email) {
    // Check if user exists
    const userRes = await pool.query('SELECT id, email, first_name FROM users WHERE email = $1', [email]);
    if (!userRes.rows[0]) {
      return null; // User not found
    }

    const user = userRes.rows[0];
    
    // Generate secure temporary password (8 characters: letters + numbers)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let tempPassword = '';
    for (let i = 0; i < 8; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Hash the temporary password
    const tempPasswordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    
    // Set expiration to 24 hours from now
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    // Update user with temporary password and expiration
    const updateRes = await pool.query(
      `UPDATE users SET 
         password_hash = $1, 
         temp_password_expires = $2, 
         updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING id, email, first_name`,
      [tempPasswordHash, expires, user.id]
    );
    
    return updateRes.rows[0] ? { user: updateRes.rows[0], tempPassword } : null;
  },

  // Check if temporary password is expired
  async isTemporaryPasswordExpired(id) {
    const res = await pool.query(
      'SELECT temp_password_expires FROM users WHERE id = $1', 
      [id]
    );
    
    if (!res.rows[0] || !res.rows[0].temp_password_expires) {
      return false; // No temporary password set
    }
    
    return new Date() > new Date(res.rows[0].temp_password_expires);
  },

  // Clear temporary password after successful change
  async clearTemporaryPassword(id) {
    const res = await pool.query(
      `UPDATE users SET 
         temp_password_expires = NULL,
         updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id`,
      [id]
    );
    
    return res.rowCount > 0;
  },

  // Suspend a user account until a specific date
  async suspend(id, suspendedUntil) {
    const res = await pool.query(
      `UPDATE users SET 
         suspended_until = $1,
         updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, email, username, first_name, last_name, organization, role, suspended_until, created_at, updated_at`,
      [suspendedUntil, id]
    );
    
    return res.rows[0] ? sanitize(res.rows[0]) : null;
  },

  // Unsuspend a user account (clear suspension)
  async unsuspend(id) {
    const res = await pool.query(
      `UPDATE users SET 
         suspended_until = NULL,
         updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, email, username, first_name, last_name, organization, role, suspended_until, created_at, updated_at`,
      [id]
    );
    
    return res.rows[0] ? sanitize(res.rows[0]) : null;
  },

  // Check if a user is currently suspended
  async isSuspended(id) {
    const res = await pool.query(
      'SELECT suspended_until FROM users WHERE id = $1',
      [id]
    );
    
    if (!res.rows[0] || !res.rows[0].suspended_until) {
      return false; // Not suspended
    }
    
    // Check if suspension is still active (future date)
    return new Date() < new Date(res.rows[0].suspended_until);
  }
};

module.exports = User;
