import mongoose from 'mongoose';
const { Schema } = mongoose;

const paymentSchema = new Schema({
  // What this payment is for
  purpose: {
    type: String,
    enum: ['subscription', 'wallet_topup', 'org_wallet_topup'],
    required: true,
    index: true,
  },

  // Who is paying — one of these is set depending on purpose
  account:      { type: Schema.Types.ObjectId, ref: 'Account',      default: null },
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },

  // Subscription-specific
  plan:          { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
  billingCycle:  { type: String, enum: ['monthly', 'yearly'], default: null },

  // Wallet-topup-specific (ownerKind needed to route the credit)
  ownerKind: { type: String, enum: ['patient', 'doctor', 'organization'], default: null },

  // Amounts
  amountCents: { type: Number, required: true, min: 1 },
  currency:    { type: String, default: 'EGP' },

  // Provider tracking
  provider:             { type: String, default: 'paymob' },
  paymobIntentionId:    { type: String, default: null, index: true, sparse: true },
  paymobTransactionId:  { type: String, default: null, index: true, sparse: true },

  // Lifecycle
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
    index: true,
  },
  failureReason: { type: String, default: null },
  processedAt:   { type: Date,   default: null },
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);