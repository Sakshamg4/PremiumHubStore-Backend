import express from 'express';
import Vendor from '../models/Vendor.js';
import Purchase from '../models/Purchase.js';
import Payment from '../models/Payment.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CreateVendorSchema, UpdateVendorSchema } from '../validators/schemas.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/vendors
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    let query = {};
    
    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    const vendors = await Vendor.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vendor.countDocuments(query);

    res.json({
      vendors,
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

// POST /api/v1/vendors
router.post('/', authorize('admin', 'manager', 'sales'), validate(CreateVendorSchema), async (req, res, next) => {
  try {
    const vendor = new Vendor(req.body);
    await vendor.save();

    res.status(201).json({
      message: 'Vendor created successfully',
      vendor
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/vendors/:id
router.get('/:id', async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({
        error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' }
      });
    }

    res.json({ vendor });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/vendors/:id/summary
router.get('/:id/summary', async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({
        error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' }
      });
    }

    // Get vendor statistics
    const [purchaseStats, paymentStats] = await Promise.all([
      Purchase.aggregate([
        { $match: { vendorId: vendor._id } },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: 1 },
            totalPayoutPaise: { $sum: '$amounts.vendorPayTotalPaise' },
            totalDuePaise: { $sum: '$settlement.vendorDuePaise' }
          }
        }
      ]),
      Payment.aggregate([
        {
          $lookup: {
            from: 'purchases',
            localField: 'purchaseId',
            foreignField: '_id',
            as: 'purchase'
          }
        },
        { $unwind: '$purchase' },
        { $match: { 'purchase.vendorId': vendor._id, type: 'VENDOR' } },
        {
          $group: {
            _id: null,
            totalPaidPaise: { $sum: '$amountPaise' }
          }
        }
      ])
    ]);

    const stats = purchaseStats[0] || { totalPurchases: 0, totalPayoutPaise: 0, totalDuePaise: 0 };
    const payments = paymentStats[0] || { totalPaidPaise: 0 };

    res.json({
      vendor,
      summary: {
        totalPurchases: stats.totalPurchases,
        totalPayoutPaise: stats.totalPayoutPaise,
        totalPaidPaise: payments.totalPaidPaise,
        totalDuePaise: stats.totalDuePaise
      }
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/vendors/:id
router.patch('/:id', authorize('admin', 'manager'), validate(UpdateVendorSchema), async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({
        error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' }
      });
    }

    res.json({
      message: 'Vendor updated successfully',
      vendor
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/vendors/:id
router.delete('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' }
      });
    }

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
