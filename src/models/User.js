import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema } = mongoose;

const UserSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization' }, // optional multi-tenant
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  role: { 
    type: String, 
    enum: ['admin', 'manager', 'sales', 'finance', 'viewer'], 
    default: 'viewer' 
  },
  passwordHash: { type: String, required: true },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  lastLoginAt: { type: Date },
  refreshTokens: [{ type: String }] // Store refresh tokens
}, { 
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.passwordHash;
      delete ret.refreshTokens;
      return ret;
    }
  }
});

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

// Update last login
UserSchema.methods.updateLastLogin = function() {
  this.lastLoginAt = new Date();
  return this.save();
};

export default mongoose.model('User', UserSchema);
