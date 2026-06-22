// models/account.model.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const accountSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{7,14}$/, 'Please use a valid E.164 phone number'],
    },
    passwordHash: { type: String, required: true, select: false },

    fullName:  { type: String, required: true, trim: true },
    avatarUrl: { type: String },

    // What kind of account this is. Staff accounts join orgs via Membership.
    role: {
      type: String,
      enum: ['patient', 'staff', 'super_admin'],
      required: true,
      index: true,
    },

    // ── Localization (needed for WhatsApp templates & ETA display) ──
    preferredLanguage: { type: String, enum: ['ar', 'en'], default: 'ar' },
    timezone:          { type: String, default: 'Africa/Cairo' },

    status: {
      type: String,
      enum: ['pending_verification', 'active', 'deactivated', 'deleted'],
      default: 'pending_verification',
      index: true,
    },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },

    lastLoginAt: { type: Date, default: null },
    deletedAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique email — only for non-deleted accounts
accountSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'deleted' } } }
);

// Unique phone — only when provided AND not deleted
accountSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $type: 'string' },
      status: { $ne: 'deleted' },
    },
  }
);

export default mongoose.model('Account', accountSchema);