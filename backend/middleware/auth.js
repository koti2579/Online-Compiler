const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token. User not found.' 
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({ 
        error: 'Account is temporarily locked due to too many failed login attempts.' 
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token.' 
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired. Please login again.' 
      });
    } else {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ 
        error: 'Internal server error during authentication.' 
      });
    }
  }
};

// Middleware to check if user is verified (optional)
const requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({ 
      error: 'Please verify your email address to access this resource.' 
    });
  }
  next();
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET || 'fallback-secret-key',
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'online-compiler',
      audience: 'online-compiler-users'
    }
  );
};

// Generate refresh token (longer expiry)
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' }, 
    process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key',
    { 
      expiresIn: '30d',
      issuer: 'online-compiler',
      audience: 'online-compiler-users'
    }
  );
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key');
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  authenticateToken,
  requireEmailVerification,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};