import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import Upload from '../models/Upload.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// All routes require authentication
router.use(authenticate);

// POST /api/v1/uploads/sign - Get Cloudinary signature for direct upload
router.post('/sign', async (req, res, next) => {
  try {
    const { folder = 'premium-hub' } = req.body;
    
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
      timestamp,
      folder,
      resource_type: 'image'
    };

    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    res.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/uploads - Upload file to Cloudinary
router.post('/', authorize('admin', 'manager', 'sales', 'finance'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'NO_FILE', message: 'No file provided' }
      });
    }

    const { kind = 'OTHER', purchaseId } = req.body;

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'premium-hub',
          resource_type: 'image',
          transformation: [
            { width: 1200, height: 1200, crop: 'limit', quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    // Save upload record
    const uploadRecord = new Upload({
      url: uploadResult.secure_url,
      kind,
      purchaseId: purchaseId || undefined,
      uploadedBy: req.user._id,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    await uploadRecord.save();

    res.status(201).json({
      message: 'File uploaded successfully',
      upload: {
        id: uploadRecord._id,
        url: uploadRecord.url,
        kind: uploadRecord.kind,
        filename: uploadRecord.filename,
        size: uploadRecord.size
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/uploads
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, kind, purchaseId } = req.query;
    
    let query = {};
    if (kind) query.kind = kind;
    if (purchaseId) query.purchaseId = purchaseId;

    const uploads = await Upload.find(query)
      .populate('purchaseId', 'orderId')
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Upload.countDocuments(query);

    res.json({
      uploads,
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

// DELETE /api/v1/uploads/:id
router.delete('/:id', authorize('admin', 'manager', 'finance'), async (req, res, next) => {
  try {
    const upload = await Upload.findById(req.params.id);

    if (!upload) {
      return res.status(404).json({
        error: { code: 'UPLOAD_NOT_FOUND', message: 'Upload not found' }
      });
    }

    // Extract public_id from Cloudinary URL
    const urlParts = upload.url.split('/');
    const publicIdWithExtension = urlParts[urlParts.length - 1];
    const publicId = `premium-hub/${publicIdWithExtension.split('.')[0]}`;

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Delete from database
    await Upload.findByIdAndDelete(req.params.id);

    res.json({ message: 'Upload deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
