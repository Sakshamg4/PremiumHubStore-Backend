import mongoose from 'mongoose';

const { Schema } = mongoose;

const ProductSchema = new Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, trim: true },
  category: { type: String, trim: true },
  defaultVendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
  baseCostPaise: { type: Number, min: 0 }, // typical vendor cost baseline
  defaultPricePaise: { type: Number, min: 0 }, // typical client price
  defaultValidityMonths: { type: Number, min: 1 }, // 1, 3, 6, 12, 24 etc.
  defaultWarrantyMonths: { type: Number, min: 0 },
  activationMethods: [{
    type: String,
    enum: ['LOGIN_CREDENTIALS', 'COUPON_CODE', 'EMAIL_INVITE']
  }],
  notes: { type: String, trim: true }
}, { timestamps: true });

// Indexes
ProductSchema.index({ name: 1 });
ProductSchema.index({ sku: 1 }, { unique: true, sparse: true });
ProductSchema.index({ category: 1 });
ProductSchema.index({ defaultVendorId: 1 });

// Text search index
ProductSchema.index({ 
  name: 'text', 
  sku: 'text',
  category: 'text',
  notes: 'text'
});

export default mongoose.model('Product', ProductSchema);
