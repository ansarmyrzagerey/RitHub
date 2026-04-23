const jwt = require('jsonwebtoken');
const User = require('../models/user');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

  const secret = process.env.JWT_SECRET || 'dev_secret';
  const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'Token is not valid' });
    }

    // Check if account is suspended
    if (user.suspended_until && new Date() < new Date(user.suspended_until)) {
      return res.status(403).json({ 
        error: 'Account suspended',
        message: `Your account is suspended until ${new Date(user.suspended_until).toLocaleString()}`
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

// Role-based middleware
const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

const requireResearcher = requireRole('researcher');
const requireAdmin = requireRole('admin');

module.exports = { auth, requireRole, requireResearcher, requireAdmin };