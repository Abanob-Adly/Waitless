import mongoose from 'mongoose';
const { Schema } = mongoose;

const paymentSchema = new Schema({
  purpose: {
    type: String,
    enum: ['subscription', 'appointment'],
    required: true,
    index: true,
  },

  // Payer — exactly one of these depending on purpose
  account:      { type: Schema.Types.ObjectId, ref: 'Account',      default: null, index: true, sparse: true },
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true, sparse: true },

  // Subscription-specific
  plan:         { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
  billingCycle: { type: String, enum: ['monthly', 'yearly'], default: null },

  // Appointment-specific
  appointment:  { type: Schema.Types.ObjectId, ref: 'Appointment', default: null, index: true, sparse: true },

  // Amounts
  amountCents: { type: Number, required: true, min: 1 },
  currency:    { type: String, default: 'EGP' },

  // Provider tracking
  provider:            { type: String, default: 'paymob' },
  paymobIntentionId:   { type: String, default: null, index: true, sparse: true },
  paymobTransactionId: { type: String, default: null, index: true, sparse: true },

  // Lifecycle
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'refunded'],
    default: 'pending',
    index: true,
  },
  failureReason: { type: String, default: null },
  processedAt:   { type: Date,   default: null },
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);