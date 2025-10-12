import express from 'express';
import Purchase from '../models/Purchase.js';
import Payment from '../models/Payment.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CreatePurchaseSchema, UpdatePurchaseSchema, PurchaseQuerySchema } from '../validators/schemas.js';
import { updatePurchaseSettlement } from '../services/purchaseService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/purchases
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      from,
      to,
      status,
      clientId,
      vendorId,
      productId,
      search
    } = req.query;

    let query = {};

    // Date range filter
    if (from || to) {
      query.purchaseDate = {};
      if (from) query.purchaseDate.$gte = new Date(from);
      if (to) query.purchaseDate.$lte = new Date(to);
    }

    // Status filter
    if (status) query.status = status;

    // Entity filters
    if (clientId) query.clientId = clientId;
    if (vendorId) query.vendorId = vendorId;
    if (productId) query.productId = productId;

    // Text search on orderId
    if (search) {
      query.orderId = { $regex: search, $options: 'i' };
    }

    const purchases = await Purchase.find(query)
      .populate('clientId', 'name email phone')
      .populate('vendorId', 'name contactName')
      .populate('productId', 'name sku')
      .populate('createdBy', 'name')
      .sort({ purchaseDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Purchase.countDocuments(query);

    res.json({
      purchases,
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

// POST /api/v1/purchases
router.post('/', authorize('admin', 'manager', 'sales'), validate(CreatePurchaseSchema), async (req, res, next) => {
  try {
    const purchaseData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Handle password encryption if provided
    if (purchaseData.activation?.credentials?.password) {
      const purchase = new Purchase(purchaseData);
      purchase.setPassword(purchaseData.activation.credentials.password);
      delete purchaseData.activation.credentials.password;
      purchaseData.activation.credentials.passwordEncrypted = purchase.activation.credentials.passwordEncrypted;
    }

    const purchase = new Purchase(purchaseData);
    await purchase.save();

    await purchase.populate([
      { path: 'clientId', select: 'name email phone' },
      { path: 'vendorId', select: 'name contactName' },
      { path: 'productId', select: 'name sku' },
      { path: 'createdBy', select: 'name' }
    ]);

    res.status(201).json({
      message: 'Purchase created successfully',
      purchase
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/purchases/:id
router.get('/:id', async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('clientId', 'name email phone whatsapp')
      .populate('vendorId', 'name contactName phone whatsapp email')
      .populate('productId', 'name sku category')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!purchase) {
      return res.status(404).json({
        error: { code: 'PURCHASE_NOT_FOUND', message: 'Purchase not found' }
      });
    }

    // Don't expose encrypted password in response
    const purchaseObj = purchase.toObject();
    if (purchaseObj.activation?.credentials?.passwordEncrypted) {
      purchaseObj.activation.credentials.hasPassword = true;
      delete purchaseObj.activation.credentials.passwordEncrypted;
    }

    res.json({ purchase: purchaseObj });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/purchases/:id
router.patch('/:id', authorize('admin', 'manager', 'sales', 'finance'), validate(UpdatePurchaseSchema), async (req, res, next) => {
  try {
    const updateData = {
      ...req.body,
      updatedBy: req.user._id
    };

    // Handle password encryption if provided
    if (updateData.activation?.credentials?.password) {
      const tempPurchase = new Purchase();
      tempPurchase.setPassword(updateData.activation.credentials.password);
      delete updateData.activation.credentials.password;
      updateData.activation.credentials.passwordEncrypted = tempPurchase.activation.credentials.passwordEncrypted;
    }

    const purchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'clientId', select: 'name email phone' },
      { path: 'vendorId', select: 'name contactName' },
      { path: 'productId', select: 'name sku' },
      { path: 'updatedBy', select: 'name' }
    ]);

    if (!purchase) {
      return res.status(404).json({
        error: { code: 'PURCHASE_NOT_FOUND', message: 'Purchase not found' }
      });
    }

    res.json({
      message: 'Purchase updated successfully',
      purchase
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/purchases/:id/files
router.post('/:id/files', authorize('admin', 'manager', 'sales', 'finance'), async (req, res, next) => {
  try {
    const { type, urls } = req.body; // type: 'client' | 'vendor', urls: string[]

    if (!type || !urls || !Array.isArray(urls)) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Type and URLs array required' }
      });
    }

    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        error: { code: 'PURCHASE_NOT_FOUND', message: 'Purchase not found' }
      });
    }

    // Add URLs to appropriate array
    if (type === 'client') {
      purchase.files.clientPaymentProofUrls.push(...urls);
    } else if (type === 'vendor') {
      purchase.files.vendorPaymentProofUrls.push(...urls);
    } else {
      return res.status(400).json({
        error: { code: 'INVALID_TYPE', message: 'Type must be client or vendor' }
      });
    }

    purchase.updatedBy = req.user._id;
    await purchase.save();

    res.json({
      message: 'Files attached successfully',
      files: purchase.files
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/purchases/:id/payments
router.get('/:id/payments', async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        error: { code: 'PURCHASE_NOT_FOUND', message: 'Purchase not found' }
      });
    }

    const payments = await Payment.find({ purchaseId: req.params.id })
      .populate('createdBy', 'name')
      .sort({ paidOn: -1 });

    res.json({ payments });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/purchases/:id
router.delete('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const purchase = await Purchase.findByIdAndDelete(req.params.id);

    if (!purchase) {
      return res.status(404).json({
        error: { code: 'PURCHASE_NOT_FOUND', message: 'Purchase not found' }
      });
    }

    // Also delete associated payments
    await Payment.deleteMany({ purchaseId: req.params.id });

    res.json({ message: 'Purchase deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
