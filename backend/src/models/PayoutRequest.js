import mongoose from 'mongoose';
const { Schema } = mongoose;

const payoutRequestSchema = new Schema({
  organization:     { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  requestedBy:      { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  amount:           { type: Number, required: true, min: 100 },
  currency:         { type: String, default: 'EGP' },

  destinationType:  { type: String, enum: ['bank', 'mobile_wallet'], required: true },
  destinationDetails: {
    bankName:       { type: String, default: '' },
    accountNumber:  { type: String, default: '' },
    accountName:    { type: String, default: '' },
    mobileWallet:   { type: String, default: '' },
    mobileProvider: { type: String, default: '' },
    iban:           { type: String, default: '' },
  },

  status:           { type: String, enum: ['pending', 'processing', 'completed', 'rejected'], default: 'pending' },

  processedBy:      { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  processedAt:      { type: Date, default: null },
  notes:            { type: String, default: '' },

  walletEntry:      { type: Schema.Types.ObjectId, ref: 'WalletEntry', default: null },
}, { timestamps: true });

payoutRequestSchema.index({ organization: 1, createdAt: -1 });
payoutRequestSchema.index({ status: 1 });

export default mongoose.model('PayoutRequest', payoutRequestSchema);