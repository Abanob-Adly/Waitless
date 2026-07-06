/**
 * seed.js — Run once to bootstrap a fresh database.
 *
 * Usage:
 *   node seed.js
 *
 * What it does:
 *   1. Connects to MongoDB (reads MONGO_URI from .env)
 *   2. Creates three SubscriptionPlan tiers if they don't exist:
 *        - Free Trial  (0 EGP, 1 branch, 5 doctors)
 *        - Standard    (299 EGP, 3 branches, 15 doctors, marketplace)
 *        - Enterprise  (799 EGP, unlimited branches/doctors, marketplace)
 *   3. Assigns a trial subscription to every existing organization that
 *      currently has no active subscription (safe to run on a populated DB).
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// ── Inline schema definitions (avoid importing app code so the seed
//    doesn't need all env vars like RESEND_API_KEY to be set) ──────────────────

const planSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, unique: true },
    description:  { type: String },
    priceMonthly: { type: Number, required: true, min: 0 },
    yearlyDiscount: { type: Number, min: 0 },
    currency:     { type: String, default: 'EGP' },
    limits: {
      maxBranches:           { type: Number, default: 1 },
      maxDoctors:            { type: Number, default: 1 },
      maxAdmins:             { type: Number, default: 1 },
      maxReceptionists:      { type: Number, default: 0 },
      maxWhatsappNumbers:    { type: Number, default: 0 },
      marketplaceListing:    { type: Boolean, default: false },
      whatsappNotifications: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const subscriptionSchema = new mongoose.Schema(
  {
    organization:      { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    plan:              { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    state:             { type: String, enum: ['trial', 'active', 'past_due', 'cancelled', 'expired'], default: 'trial' },
    billingCycle:      { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    currentPeriodStart:{ type: Date, required: true },
    currentPeriodEnd:  { type: Date, required: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt:       { type: Date, default: null },
    provider:          { type: String, enum: ['paymob', 'manual'], default: 'manual' },
  },
  { timestamps: true },
);

const orgSchema = new mongoose.Schema({ name: String, status: String });

const SubscriptionPlan = mongoose.model('SubscriptionPlan', planSchema);
const Subscription     = mongoose.model('Subscription',     subscriptionSchema);
const Organization     = mongoose.model('Organization',     orgSchema);

// ── Plan definitions ──────────────────────────────────────────────────────────

const PLANS = [
  {
    name:         'Free Trial',
    description:  'Get started — no credit card required.',
    priceMonthly: 0,
    currency:     'EGP',
    limits: {
      maxBranches:           1,
      maxDoctors:            1,
      maxAdmins:             1,
      maxReceptionists:      0,   // receptionists disabled on free plan
      maxWhatsappNumbers:    0,
      marketplaceListing:    false,
      whatsappNotifications: false,
    },
    isActive: true,
  },
  {
    name:         'Standard',
    description:  'For growing clinics.',
    priceMonthly: 299,
    yearlyDiscount: 20,
    currency:     'EGP',
    limits: {
      maxBranches:           3,
      maxDoctors:            3,
      maxAdmins:             2,
      maxReceptionists:      3,
      maxWhatsappNumbers:    2,
      marketplaceListing:    true,
      whatsappNotifications: true,
    },
    isActive: true,
  },
  {
    name:         'Enterprise',
    description:  'Unlimited scale for hospital networks.',
    priceMonthly: 799,
    yearlyDiscount: 25,
    currency:     'EGP',
    limits: {
      maxBranches:           5,
      maxDoctors:            15,
      maxAdmins:             5,
      maxReceptionists:      5,
      maxWhatsappNumbers:    5,
      marketplaceListing:    true,
      whatsappNotifications: true,
    },
    isActive: true,
  },
  {
    name:         'Business+',
    description:  'The ultimate plan for large healthcare organizations.',
    priceMonthly: 1499,
    yearlyDiscount: 20,
    currency:     'EGP',
    limits: {
      maxBranches:           10,
      maxDoctors:            25,
      maxAdmins:             10,
      maxReceptionists:      10,
      maxWhatsappNumbers:    10,
      marketplaceListing:    true,
      whatsappNotifications: true,
    },
    isActive: true,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('ERROR: MONGO_URI is not set. Create a .env file with MONGO_URI=...');
    process.exit(1);
  }

  console.log('Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('Connected.\n');

  // ── 1. Upsert subscription plans ──────────────────────────────────────────

  console.log('Seeding subscription plans…');
  let freePlan = null;

  for (const planData of PLANS) {
    const plan = await SubscriptionPlan.findOneAndUpdate(
      { name: planData.name },
      { $set: planData },
      { upsert: true, new: true },
    );
    console.log(`  ✓ ${plan.name} (${plan._id})`);
    if (planData.name === 'Free Trial') freePlan = plan;
  }

  // ── 2. Assign a trial subscription to orgs that have none ─────────────────

  console.log('\nChecking organizations for missing subscriptions…');

  const orgs = await Organization.find({ status: { $ne: 'deleted' } }).select('_id name');
  let assigned = 0;

  for (const org of orgs) {
    const existing = await Subscription.findOne({
      organization: org._id,
      state: { $in: ['trial', 'active', 'past_due'] },
    });

    if (!existing) {
      const now = new Date();
      await Subscription.create({
        organization:       org._id,
        plan:               freePlan._id,
        state:              'trial',
        currentPeriodStart: now,
        currentPeriodEnd:   new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
      });
      console.log(`  ✓ Assigned Free Trial to org: ${org.name || org._id}`);
      assigned++;
    } else {
      console.log(`  – Skipped org: ${org.name || org._id} (already has subscription)`);
    }
  }

  if (orgs.length === 0) {
    console.log('  (No organizations found — subscriptions will be assigned on first org creation)');
  }

  console.log(`\nDone! Plans seeded: ${PLANS.length} | Trial subscriptions created: ${assigned}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
