import mongoose from 'mongoose';

const { Schema } = mongoose;

const VendorSchema = new Schema({
  name: { type: String, required: true, trim: true },
  contactName: { type: String, trim: true },
  phone: { type: String, trim: true },
  whatsapp: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  notes: { type: String, trim: true }
}, { timestamps: true });

// Indexes
VendorSchema.index({ name: 1 });
VendorSchema.index({ email: 1 });
VendorSchema.index({ phone: 1 });

// Text search index
VendorSchema.index({ 
  name: 'text', 
  contactName: 'text',
  email: 'text', 
  phone: 'text',
  notes: 'text'
});

export default mongoose.model('Vendor', VendorSchema);
