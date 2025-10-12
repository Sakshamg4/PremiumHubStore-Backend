import express from 'express';
import Product from '../models/Product.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CreateProductSchema, UpdateProductSchema } from '../validators/schemas.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/products
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;
    
    let query = {};
    
    // Text search
    if (search) {
      query.$text = { $search: search };
    }
    
    // Filter by category
    if (category) {
      query.category = category;
    }

    const products = await Product.find(query)
      .populate('defaultVendorId', 'name contactName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.json({
      products,
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

// POST /api/v1/products
router.post('/', authorize('admin', 'manager'), validate(CreateProductSchema), async (req, res, next) => {
  try {
    const product = new Product(req.body);
    await product.save();
    
    await product.populate('defaultVendorId', 'name contactName');

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('defaultVendorId', 'name contactName');
    
    if (!product) {
      return res.status(404).json({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' }
      });
    }

    res.json({ product });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/products/:id
router.patch('/:id', authorize('admin', 'manager'), validate(UpdateProductSchema), async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('defaultVendorId', 'name contactName');

    if (!product) {
      return res.status(404).json({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' }
      });
    }

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/products/:id
router.delete('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' }
      });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
