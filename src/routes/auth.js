import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { LoginSchema, RegisterSchema, ChangePasswordSchema } from '../validators/schemas.js';

const router = express.Router();

// Generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '10m' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

// POST /api/v1/auth/register - Admin only to create users
router.post('/register', authenticate, validate(RegisterSchema), async (req, res, next) => {
  try {
    // Only admin can register new users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only admins can create users' }
      });
    }

    const { name, email, password, role, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        error: { code: 'USER_EXISTS', message: 'User with this email already exists' }
      });
    }

    // Create user
    const user = new User({
      name,
      email,
      passwordHash: password, // Will be hashed by pre-save middleware
      role,
      phone
    });

    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/login
router.post('/login', validate(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Store refresh token and update last login
    await User.findByIdAndUpdate(
      user._id,
      { 
        $push: { refreshTokens: refreshToken },
        lastLoginAt: new Date()
      }
    );

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token required' }
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' }
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user._id);

    // Replace old refresh token with new one
    await User.findByIdAndUpdate(
      user._id,
      {
        $pull: { refreshTokens: refreshToken },
        $push: { refreshTokens: tokens.refreshToken }
      }
    );

    res.json({
      message: 'Tokens refreshed successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' }
      });
    }
    next(error);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Remove specific refresh token
      await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { refreshTokens: refreshToken } }
      );
    } else {
      // Remove all refresh tokens (logout from all devices)
      await User.findByIdAndUpdate(
        req.user._id,
        { $set: { refreshTokens: [] } }
      );
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/change-password
router.post('/change-password', authenticate, validate(ChangePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+passwordHash');

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' }
      });
    }

    // Update password
    user.passwordHash = newPassword; // Will be hashed by pre-save middleware
    user.refreshTokens = []; // Invalidate all refresh tokens
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
