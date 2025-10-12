import mongoose from 'mongoose';

const { Schema } = mongoose;

const PaymentSchema = new Schema({
  purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase', required: true },
  type: { type: String, enum: ['CLIENT', 'VENDOR'], required: true },
  amountPaise: { type: Number, required: true, min: 0 },
  paidOn: { type: Date, required: true },
  method: { 
    type: String, 
    enum: ['UPI', 'CARD', 'BANK', 'CASH', 'OTHER'] 
  },
  reference: { type: String, trim: true },
  screenshotUrl: { type: String, trim: true },
  notes: { type: String, trim: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Indexes
PaymentSchema.index({ purchaseId: 1 });
PaymentSchema.index({ paidOn: -1 });
PaymentSchema.index({ type: 1 });
PaymentSchema.index({ purchaseId: 1, type: 1 });

export default mongoose.model('Payment', PaymentSchema);
