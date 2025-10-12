import express from 'express';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { UpdateUserSchema, PaginationSchema } from '../validators/schemas.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/users/me
router.get('/me', async (req, res, next) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        status: req.user.status,
        phone: req.user.phone,
        lastLoginAt: req.user.lastLoginAt,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/users - Admin only
router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const users = await User.find(query)
      .select('-refreshTokens')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/users/:id - Admin only
router.get('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-refreshTokens');
    
    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/users/:id - Admin only
router.patch('/:id', authorize('admin'), validate(UpdateUserSchema), async (req, res, next) => {
  try {
    const { name, phone, role, status } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    // Update fields
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (role !== undefined) user.role = role;
    if (status !== undefined) user.status = status;

    user.updatedAt = new Date();
    await user.save();

    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/users/:id - Admin only
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        error: { code: 'CANNOT_DELETE_SELF', message: 'Cannot delete your own account' }
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
