const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { 
  authenticateToken, 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} = require('../middleware/auth');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// @route   GET /api/auth/me
// @desc    Get current authenticated user
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // req.user is set by authenticateToken and excludes password
    const safeUser = req.user?.toJSON ? req.user.toJSON() : req.user;
    return res.json({ user: safeUser });
  } catch (error) {
    console.error('Fetch current user error:', error);
    return res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

// Stricter rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 login attempts per windowMs
  message: {
    error: 'Too many login attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body.email) {
    req.body.email = req.body.email.trim().toLowerCase();
  }
  if (req.body.username) {
    req.body.username = req.body.username.trim();
  }
  if (req.body.identifier) {
    req.body.identifier = req.body.identifier.trim();
  }
  next();
};

// Validation middleware
const validateSignup = (req, res, next) => {
  const { username, email, password, confirmPassword } = req.body;
  const errors = [];

  // Username validation
  if (!username || username.length < 3 || username.length > 30) {
    errors.push('Username must be between 3 and 30 characters');
  }
  if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  // Email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Please provide a valid email address');
  }

  // Password validation
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
  }

  // Confirm password validation
  if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { identifier, password } = req.body;
  const errors = [];

  if (!identifier || !identifier.trim()) {
    errors.push('Username or email is required');
  }

  if (!password) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
};

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', authLimiter, sanitizeInput, validateSignup, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email },
        { username: username }
      ]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({ 
          error: 'User with this email already exists' 
        });
      } else {
        return res.status(409).json({ 
          error: 'Username is already taken' 
        });
      }
    }

    // Create new user
    const user = new User({
      username,
      email,
      password // Will be hashed by the pre-save middleware
    });

    await user.save();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Remove sensitive data from response
    const userResponse = user.toJSON();

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      token,
      refreshToken
    });

  } catch (error) {
    console.error('Signup error:', error);

    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ 
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` 
      });
    }

    res.status(500).json({ 
      error: 'Internal server error during registration' 
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginLimiter, sanitizeInput, validateLogin, async (req, res) => {
  try {
    const { identifier, password, rememberMe } = req.body;

    // Find user by email or username
    const user = await User.findByEmailOrUsername(identifier);

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid details',
        message: 'Username/email or password is incorrect'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({ 
        error: 'Account is temporarily locked due to too many failed login attempts. Please try again later.' 
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({ 
        error: 'Invalid details',
        message: 'Username/email or password is incorrect'
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate tokens
    const tokenExpiry = rememberMe ? '30d' : '7d';
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Remove sensitive data from response
    const userResponse = user.toJSON();

    res.json({
      message: 'Login successful',
      user: userResponse,
      token,
      refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error during login' 
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ 
        error: 'Refresh token is required' 
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Check if user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found' 
      });
    }

    // Generate new access token
    const newToken = generateToken(user._id);

    res.json({
      token: newToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ 
      error: 'Invalid refresh token' 
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticateToken, (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // Here we just confirm the logout
  res.json({ 
    message: 'Logged out successfully' 
  });
});

// Removed duplicate /me route; consolidated above with sanitized user output

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', authLimiter, sanitizeInput, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // In a real application, you would send an email here
    // For now, we'll just log it (remove in production)
    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.',
      // Remove this in production - only for development
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ 
        error: 'Token, password, and confirm password are required' 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        error: 'Passwords do not match' 
      });
    }

    // Hash the token to compare with stored hash
    const crypto = require('crypto');
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = undefined;
    user.lockUntil = undefined;

    await user.save();

    res.json({ 
      message: 'Password reset successful' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;