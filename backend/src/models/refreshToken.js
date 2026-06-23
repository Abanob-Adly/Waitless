import mongoose from 'mongoose';
const { Schema } = mongoose;

const refreshTokenSchema = new Schema({
  account:   { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },

  // Rotation chain — set when this token is exchanged for a new one
  replacedBy: { type: Schema.Types.ObjectId, ref: 'RefreshToken', default: null },
  revokedAt:  { type: Date, default: null },

  // Audit
  userAgent: { type: String },
  ip:        { type: String },

  expiresAt: { type: Date, required: true },
}, { timestamps: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RefreshToken', refreshTokenSchema);