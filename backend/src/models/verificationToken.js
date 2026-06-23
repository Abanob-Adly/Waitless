import mongoose from 'mongoose';
const { Schema } = mongoose;

const PURPOSES = ['email_verify', 'phone_verify', 'password_reset'];

const verificationTokenSchema = new Schema({
  account:    { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  purpose:    { type: String, enum: PURPOSES, required: true },

  // For OTPs: 6-digit code (hashed). For password reset: long random token (hashed).
  codeHash:   { type: String, required: true },

  // Where it was sent (snapshotted, so changing the account doesn't invalidate)
  sentTo:     { type: String, required: true },          // email or phone
  channel:    { type: String, enum: ['email', 'sms'], required: true },

  expiresAt:  { type: Date, required: true },
  attempts:   { type: Number, default: 0, min: 0 },      // Defends against negative integer manipulation
  consumedAt: { type: Date, default: null },
}, { timestamps: true });

// 1. Native MongoDB TTL index — auto-deletes expired docs
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 2. FIXED: Enforce unique constraint using a Partial Filter Index
// This guarantees exactly ONE unconsumed token can exist per account+purpose at any moment.
verificationTokenSchema.index(
  { account: 1, purpose: 1 },
  { 
    unique: true, 
    partialFilterExpression: { consumedAt: null } 
  }
);

export default mongoose.model('VerificationToken', verificationTokenSchema);
