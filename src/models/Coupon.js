import mongoose from 'mongoose';

const { Schema } = mongoose;

const CouponSchema = new Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  discountType: { type: String, enum: ['PERCENT', 'FLAT'] },
  discountValuePaise: { type: Number, min: 0 },
  maxUses: { type: Number, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
  validFrom: { type: Date },
  validTo: { type: Date },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Indexes
CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ productId: 1 });
CouponSchema.index({ isActive: 1 });
CouponSchema.index({ validFrom: 1, validTo: 1 });

// Check if coupon is valid
CouponSchema.methods.isValid = function() {
  const now = new Date();
  
  if (!this.isActive) return false;
  if (this.maxUses && this.usedCount >= this.maxUses) return false;
  if (this.validFrom && now < this.validFrom) return false;
  if (this.validTo && now > this.validTo) return false;
  
  return true;
};

// Calculate discount amount
CouponSchema.methods.calculateDiscount = function(amountPaise) {
  if (!this.isValid()) return 0;
  
  if (this.discountType === 'PERCENT') {
    return Math.floor((amountPaise * this.discountValuePaise) / 10000); // discountValue is in basis points
  } else if (this.discountType === 'FLAT') {
    return Math.min(this.discountValuePaise, amountPaise);
  }
  
  return 0;
};

export default mongoose.model('Coupon', CouponSchema);
