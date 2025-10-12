import express from 'express';
import Client from '../models/Client.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CreateClientSchema, UpdateClientSchema, PaginationSchema } from '../validators/schemas.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/clients
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, tags } = req.query;
    
    let query = {};
    
    // Text search
    if (search) {
      query.$text = { $search: search };
    }
    
    // Filter by tags
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Client.countDocuments(query);

    res.json({
      clients,
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

// POST /api/v1/clients
router.post('/', authorize('admin', 'manager', 'sales'), validate(CreateClientSchema), async (req, res, next) => {
  try {
    const client = new Client(req.body);
    await client.save();

    res.status(201).json({
      message: 'Client created successfully',
      client
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/clients/:id
router.get('/:id', async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({
        error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' }
      });
    }

    res.json({ client });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/clients/:id
router.patch('/:id', authorize('admin', 'manager', 'sales'), validate(UpdateClientSchema), async (req, res, next) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({
        error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' }
      });
    }

    res.json({
      message: 'Client updated successfully',
      client
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/clients/:id
router.delete('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);

    if (!client) {
      return res.status(404).json({
        error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' }
      });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
