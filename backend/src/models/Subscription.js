import mongoose from 'mongoose';
const { Schema } = mongoose;

const subscriptionSchema = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  plan:         { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },

  state: {
    type: String,
    enum: ['trial', 'active', 'past_due', 'cancelled', 'expired'],
    default: 'trial',
    index: true,
  },

  billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },

  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd:   { type: Date, required: true, index: true },

  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt:       { type: Date, default: null },

  // Payment provider (added)
  provider:               { type: String, enum: ['paymob', 'manual'], default: 'manual' },
  providerCustomerId:     { type: String, default: null },
  providerSubscriptionId: { type: String, default: null, index: true, sparse: true },
}, { timestamps: true });

subscriptionSchema.index(
  { organization: 1 },
  { unique: true, partialFilterExpression: { state: { $in: ['trial', 'active', 'past_due'] } } }
);

export default mongoose.model('Subscription', subscriptionSchema);