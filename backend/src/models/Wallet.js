import mongoose from 'mongoose';
const { Schema } = mongoose;

const walletSchema = new Schema(
  {
    // Exactly one of these is set — account for personal wallets, organization for org wallets
    account:      { type: Schema.Types.ObjectId, ref: 'Account',      default: null },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    ownerKind:    { type: String, enum: ['patient', 'doctor', 'organization'], required: true },
    balance:      { type: Number, default: 0, min: 0 },
    currency:     { type: String, default: 'EGP' },
    status:       { type: String, enum: ['active', 'frozen', 'closed'], default: 'active' },
  },
  { timestamps: true },
);

walletSchema.index({ account: 1 },      { unique: true, sparse: true });
walletSchema.index({ organization: 1 }, { unique: true, sparse: true });

export default mongoose.model('Wallet', walletSchema);
