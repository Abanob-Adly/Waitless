import mongoose from 'mongoose';
const { Schema } = mongoose;

const walletEntrySchema = new Schema(
  {
    wallet:        { type: Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    type:          { type: String, enum: ['topup', 'purchase', 'earning', 'commission', 'refund', 'withdrawal', 'penalty', 'cancellation_penalty', 'plan_purchase', 'session_closure_fee', 'session_closure_refund', 'late_start_penalty'], required: true },
    direction:     { type: String, enum: ['credit', 'debit'], required: true },
    amount:        { type: Number, required: true, min: 0 },
    balanceAfter:  { type: Number, required: true },
    reference:     { type: Schema.Types.ObjectId, default: null },
    referenceKind: { type: String, default: null }, // 'appointment' | 'topup'
    description:   { type: String, default: '' },
    status:        { type: String, enum: ['pending', 'settled', 'failed'], default: 'settled' },
  },
  { timestamps: true },
);

walletEntrySchema.index({ wallet: 1, createdAt: -1 });
walletEntrySchema.index({ reference: 1, wallet: 1 });

export default mongoose.model('WalletEntry', walletEntrySchema);
