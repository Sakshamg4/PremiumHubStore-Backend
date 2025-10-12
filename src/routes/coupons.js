import express from 'express';
import Coupon from '../models/Coupon.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CreateCouponSchema, UpdateCouponSchema, ValidateCouponSchema } from '../validators/schemas.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/coupons
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;
    
    let query = {};
    
    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Search by code
    if (search) {
      query.code = { $regex: search, $options: 'i' };
    }

    const coupons = await Coupon.find(query)
      .populate('productId', 'name sku')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Coupon.countDocuments(query);

    res.json({
      coupons,
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

// POST /api/v1/coupons
router.post('/', authorize('admin', 'manager'), validate(CreateCouponSchema), async (req, res, next) => {
  try {
    const coupon = new Coupon(req.body);
    await coupon.save();
    
    await coupon.populate('productId', 'name sku');

    res.status(201).json({
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/coupons/validate
router.post('/validate', validate(ValidateCouponSchema), async (req, res, next) => {
  try {
    const { code, productId } = req.body;
    
    let query = { code: code.toUpperCase() };
    if (productId) {
      query.$or = [
        { productId: productId },
        { productId: { $exists: false } } // Generic coupons
      ];
    }

    const coupon = await Coupon.findOne(query);
    
    if (!coupon) {
      return res.json({
        valid: false,
        message: 'Coupon not found'
      });
    }

    if (!coupon.isValid()) {
      return res.json({
        valid: false,
        message: 'Coupon is expired or inactive'
      });
    }

    res.json({
      valid: true,
      coupon: {
        id: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValuePaise: coupon.discountValuePaise
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/coupons/:id
router.get('/:id', async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('productId', 'name sku');
    
    if (!coupon) {
      return res.status(404).json({
        error: { code: 'COUPON_NOT_FOUND', message: 'Coupon not found' }
      });
    }

    res.json({ coupon });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/coupons/:id
router.patch('/:id', authorize('admin', 'manager'), validate(UpdateCouponSchema), async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('productId', 'name sku');

    if (!coupon) {
      return res.status(404).json({
        error: { code: 'COUPON_NOT_FOUND', message: 'Coupon not found' }
      });
    }

    res.json({
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/coupons/:id
router.delete('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        error: { code: 'COUPON_NOT_FOUND', message: 'Coupon not found' }
      });
    }

    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
