import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/crypto.js';

const { Schema } = mongoose;

const PurchaseSchema = new Schema({
  orderId: { type: String, required: true, trim: true },
  sourcePlatform: { 
    type: String, 
    enum: ['WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'OTHER'], 
    default: 'WHATSAPP' 
  },
  sourceRef: { type: String, trim: true },
  
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
  
  purchaseDate: { type: Date, required: true },
  
  validity: {
    durationMonths: { type: Number, min: 1 },
    startDate: { type: Date },
    endDate: { type: Date }
  },
  
  warranty: {
    hasWarranty: { type: Boolean, default: false },
    months: { type: Number, min: 0 },
    endDate: { type: Date }
  },
  
  activation: {
    method: { 
      type: String, 
      enum: ['LOGIN_CREDENTIALS', 'COUPON_CODE', 'EMAIL_INVITE'], 
      required: true 
    },
    credentials: {
      username: { type: String, trim: true },
      passwordEncrypted: { type: String } // AES-256-GCM encrypted
    },
    couponCode: { type: String, trim: true },
    emailInvite: {
      invitedEmail: { type: String, lowercase: true, trim: true },
      invitedAt: { type: Date },
      status: { 
        type: String, 
        enum: ['SENT', 'DELIVERED', 'ACCEPTED', 'FAILED'] 
      }
    }
  },
  
  amounts: {
    clientPayTotalPaise: { type: Number, required: true, min: 0 },
    vendorPayTotalPaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    taxesPaise: { type: Number, default: 0, min: 0 },
    feesPaise: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' }
  },
  
  settlement: {
    clientPaidPaise: { type: Number, default: 0, min: 0 },
    vendorPaidPaise: { type: Number, default: 0, min: 0 },
    clientDuePaise: { type: Number, default: 0 },
    vendorDuePaise: { type: Number, default: 0 }
  },
  
  files: {
    clientPaymentProofUrls: [{ type: String }],
    vendorPaymentProofUrls: [{ type: String }]
  },
  
  people: {
    vendorContactName: { type: String, trim: true },
    vendorContactPhone: { type: String, trim: true }
  },
  
  status: { 
    type: String, 
    enum: ['OPEN', 'COMPLETED', 'CANCELLED'], 
    default: 'OPEN' 
  },
  
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes
PurchaseSchema.index({ orderId: 1 }, { unique: true });
PurchaseSchema.index({ purchaseDate: -1 });
PurchaseSchema.index({ clientId: 1 });
PurchaseSchema.index({ vendorId: 1 });
PurchaseSchema.index({ productId: 1 });
PurchaseSchema.index({ status: 1 });
PurchaseSchema.index({ 'validity.endDate': 1 });
PurchaseSchema.index({ 'warranty.endDate': 1 });

// Compound indexes for common queries
PurchaseSchema.index({ purchaseDate: -1, status: 1 });
PurchaseSchema.index({ clientId: 1, purchaseDate: -1 });
PurchaseSchema.index({ vendorId: 1, purchaseDate: -1 });

// Pre-save middleware to compute derived fields
PurchaseSchema.pre('save', function(next) {
  // Compute validity end date
  if (this.validity.durationMonths && (this.validity.startDate || this.purchaseDate)) {
    const startDate = this.validity.startDate || this.purchaseDate;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + this.validity.durationMonths);
    this.validity.endDate = endDate;
  }
  
  // Compute warranty end date
  if (this.warranty.hasWarranty && this.warranty.months) {
    const warrantyEnd = new Date(this.purchaseDate);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + this.warranty.months);
    this.warranty.endDate = warrantyEnd;
  }
  
  // Compute settlement dues
  this.settlement.clientDuePaise = this.amounts.clientPayTotalPaise - this.settlement.clientPaidPaise;
  this.settlement.vendorDuePaise = this.amounts.vendorPayTotalPaise - this.settlement.vendorPaidPaise;
  
  next();
});

// Virtual for profit calculation
PurchaseSchema.virtual('profitPaise').get(function() {
  return this.amounts.clientPayTotalPaise - this.amounts.vendorPayTotalPaise - (this.amounts.feesPaise || 0);
});

// Method to encrypt password
PurchaseSchema.methods.setPassword = function(password) {
  if (password) {
    this.activation.credentials.passwordEncrypted = encrypt(password);
  }
};

// Method to decrypt password
PurchaseSchema.methods.getPassword = function() {
  if (this.activation.credentials?.passwordEncrypted) {
    return decrypt(this.activation.credentials.passwordEncrypted);
  }
  return null;
};

// Method to check if purchase is expiring soon
PurchaseSchema.methods.isExpiringSoon = function(days = 30) {
  if (!this.validity.endDate) return false;
  
  const now = new Date();
  const daysUntilExpiry = Math.ceil((this.validity.endDate - now) / (1000 * 60 * 60 * 24));
  
  return daysUntilExpiry <= days && daysUntilExpiry > 0;
};

// Ensure virtuals are included in JSON
PurchaseSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Purchase', PurchaseSchema);
