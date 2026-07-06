import mongoose from 'mongoose';
const { Schema } = mongoose;

const subscriptionPlanSchema = new Schema({
  name:        { type: String, required: true, unique: true },
  description: { type: String },

  priceMonthly: { type: Number, required: true, min: 0 },
  yearlyDiscount :  { type: Number, min: 0 },
  currency:     { type: String, default: 'EGP' },

  // Plan limits (embedded — read with the plan)
  limits: {
    maxBranches:          { type: Number, default: 1 },
    maxDoctors:           { type: Number, default: 1 },
    maxAdmins:            { type: Number, default: 1 },
    maxReceptionists:     { type: Number, default: 0 },
    maxWhatsappNumbers:   { type: Number, default: 0 },
    marketplaceListing:   { type: Boolean, default: false },
    whatsappNotifications:{ type: Boolean, default: false },
  },

  // Platform cut from each consultation fee (percentage)
  platformCutPercent: { type: Number, default: 15, min: 0, max: 100 },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
