import express from 'express';
import Payment from '../models/Payment.js';
import Purchase from '../models/Purchase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CreatePaymentSchema, UpdatePaymentSchema, PaymentQuerySchema } from '../validators/schemas.js';
import { updatePurchaseSettlement } from '../services/purchaseService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/payments
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      purchaseId,
      type,
      from,
      to
    } = req.query;

    let query = {};

    // Filter by purchase
    if (purchaseId) query.purchaseId = purchaseId;

    // Filter by type
    if (type) query.type = type;

    // Date range filter
    if (from || to) {
      query.paidOn = {};
      if (from) query.paidOn.$gte = new Date(from);
      if (to) query.paidOn.$lte = new Date(to);
    }

    const payments = await Payment.find(query)
      .populate('purchaseId', 'orderId clientId vendorId productId')
      .populate('createdBy', 'name')
      .sort({ paidOn: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
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

// POST /api/v1/payments
router.post('/', authorize('admin', 'manager', 'sales', 'finance'), validate(CreatePaymentSchema), async (req, res, next) => {
  try {
    // Check if purchase exists
    const purchase = await Purchase.findById(req.body.purchaseId);
    if (!purchase) {
      return res.status(404).json({
        error: { code: 'PURCHASE_NOT_FOUND', message: 'Purchase not found' }
      });
    }

    // Role-based restrictions
    if (req.user.role === 'sales' && req.body.type === 'VENDOR') {
      return res.status(403).json({
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Sales users can only create client payments' }
      });
    }

    const payment = new Payment({
      ...req.body,
      createdBy: req.user._id
    });

    await payment.save();

    // Update purchase settlement
    await updatePurchaseSettlement(req.body.purchaseId);

    await payment.populate([
      { path: 'purchaseId', select: 'orderId' },
      { path: 'createdBy', select: 'name' }
    ]);

    res.status(201).json({
      message: 'Payment created successfully',
      payment
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/payments/:id
router.get('/:id', async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('purchaseId', 'orderId clientId vendorId productId')
      .populate('createdBy', 'name');

    if (!payment) {
      return res.status(404).json({
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' }
      });
    }

    res.json({ payment });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/payments/:id
router.patch('/:id', authorize('admin', 'manager', 'finance'), validate(UpdatePaymentSchema), async (req, res, next) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'purchaseId', select: 'orderId' },
      { path: 'createdBy', select: 'name' }
    ]);

    if (!payment) {
      return res.status(404).json({
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' }
      });
    }

    // Update purchase settlement
    await updatePurchaseSettlement(payment.purchaseId._id);

    res.json({
      message: 'Payment updated successfully',
      payment
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/payments/:id
router.delete('/:id', authorize('admin', 'manager', 'finance'), async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' }
      });
    }

    const purchaseId = payment.purchaseId;
    await Payment.findByIdAndDelete(req.params.id);

    // Update purchase settlement
    await updatePurchaseSettlement(purchaseId);

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
