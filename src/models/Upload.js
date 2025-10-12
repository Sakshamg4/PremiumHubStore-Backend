import mongoose from 'mongoose';

const { Schema } = mongoose;

const UploadSchema = new Schema({
  url: { type: String, required: true, trim: true },
  kind: { 
    type: String, 
    enum: ['CLIENT_PAYMENT', 'VENDOR_PAYMENT', 'OTHER'], 
    required: true 
  },
  purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase' },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, trim: true },
  mimetype: { type: String, trim: true },
  size: { type: Number, min: 0 }
}, { timestamps: true });

// Indexes
UploadSchema.index({ purchaseId: 1 });
UploadSchema.index({ kind: 1 });
UploadSchema.index({ uploadedBy: 1 });
UploadSchema.index({ createdAt: -1 });

export default mongoose.model('Upload', UploadSchema);
