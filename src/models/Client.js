import mongoose from 'mongoose';

const { Schema } = mongoose;

const ClientSchema = new Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  whatsapp: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  tags: [{ type: String, trim: true }],
  notes: { type: String, trim: true }
}, { timestamps: true });

// Indexes
ClientSchema.index({ name: 1 });
ClientSchema.index({ email: 1 });
ClientSchema.index({ phone: 1 });
ClientSchema.index({ tags: 1 });

// Text search index
ClientSchema.index({ 
  name: 'text', 
  email: 'text', 
  phone: 'text',
  notes: 'text'
});

export default mongoose.model('Client', ClientSchema);
