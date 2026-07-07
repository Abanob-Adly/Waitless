import Organization from '../models/Organization.js';
import { AdminMembership } from '../models/Membership.js';
import Subscription from '../models/Subscription.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Wallet from '../models/Wallet.js';
import WalletEntry from '../models/WalletEntry.js';
import Invoice from '../models/Invoice.js';
import { getActiveSubscription } from '../utils/subscription.js';
import { tokenService } from './token.js';
// import { paymobService } from './paymobService.js';
import { AppError, Conflict, Forbidden } from '../utils/errors.js';
import Branch from '../models/Branch.js';
import { walletService } from './walletService.js';

// ── Plan fallback defaults (used only when DB has no plans) ──────────────────

const PLAN_DEFAULTS = [
  {
    name: 'Free Trial',
    description: 'Get started — no credit card required.',
    priceMonthly: 0,
    currency: 'EGP',
    limits: { maxBranches: 1, maxDoctors: 1, maxAdmins: 1, maxReceptionists: 0, maxWhatsappNumbers: 0, marketplaceListing: false, whatsappNotifications: false },
    isActive: true,
  },
  {
    name: 'Standard',
    description: 'For growing clinics.',
    priceMonthly: 299,
    yearlyDiscount: 20,
    currency: 'EGP',
    limits: { maxBranches: 3, maxDoctors: 3, maxAdmins: 2, maxReceptionists: 3, maxWhatsappNumbers: 2, marketplaceListing: true, whatsappNotifications: true },
    isActive: true,
  },
  {
    name: 'Enterprise',
    description: 'Unlimited scale for hospital networks.',
    priceMonthly: 799,
    yearlyDiscount: 25,
    currency: 'EGP',
    limits: { maxBranches: 5, maxDoctors: 15, maxAdmins: 5, maxReceptionists: 5, maxWhatsappNumbers: 5, marketplaceListing: true, whatsappNotifications: true },
    isActive: true,
  },
  {
    name: 'Business+',
    description: 'The ultimate plan for large healthcare organizations.',
    priceMonthly: 1499,
    yearlyDiscount: 20,
    currency: 'EGP',
    limits: { maxBranches: 10, maxDoctors: 25, maxAdmins: 10, maxReceptionists: 10, maxWhatsappNumbers: 10, marketplaceListing: true, whatsappNotifications: true },
    isActive: true,
  },
];

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _activatePlan(orgId, plan) {
  const now = new Date();
  return Subscription.findOneAndUpdate(
    { organization: orgId },
    {
      $set: {
        plan: plan._id,
        state: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        provider: 'manual',
      },
    },
    { upsert: true, new: true },
  ).populate('plan');
}

async function _createInvoice(orgId, plan, amount, paymentMethod, extra = {}) {
  const now = new Date();
  return Invoice.create({
    organization: orgId,
    plan: plan._id,
    planName: plan.name,
    amount,
    currency: 'EGP',
    paymentMethod,
    status: amount === 0 ? 'paid' : 'paid',
    periodStart: now,
    periodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    ...extra,
  });
}

export const orgService = {
  async createOrg({ actor, data }) {
    const existing = await Organization.findOne({ slug: data.slug, status: { $ne: 'deleted' } });
    if (existing) throw Conflict('Slug already taken');

    const org = await Organization.create({ ...data, status: 'active' });

    await AdminMembership.create({
      account: actor.account._id,
      organization: org._id,
      kind: 'admin',
      status: 'active',
      acceptedAt: new Date(),
      isSuper: true,
      permissions: ['*'],
    });

    const plan = await SubscriptionPlan.findOne({ isActive: true }).sort({ priceMonthly: 1 });
    if (plan) {
      const now = new Date();
      await Subscription.create({
        organization: org._id,
        plan: plan._id,
        state: 'trial',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      });
    }

    const accessToken = tokenService.signAccessToken(actor.account, org._id);
    return { org, accessToken };
  },

  async getOrg({ org }) {
    const subscription = await getActiveSubscription(org._id);
    return { org, subscription };
  },

  async updateOrg({ org, data }) {
    if (data.whatsappNumber !== undefined) {
      const sub = await getActiveSubscription(org._id);
      if (!sub?.plan?.limits?.whatsappNotifications) {
        throw Forbidden('Your plan does not include WhatsApp notifications');
      }
    }
    Object.assign(org, data);
    await org.save();
    return org;
  },

  async toggleVisibility({ org, isPublic }) {
    if (isPublic) {
      const sub = await getActiveSubscription(org._id);
      if (!sub?.plan?.limits?.marketplaceListing) {
        throw Forbidden('Your plan does not include marketplace listing');
      }
    }
    org.isPublic = isPublic;
    await org.save();
    return org;
  },

  async getSubscription({ org }) {
    return getActiveSubscription(org._id);
  },

  async listPlans() {
    let plans = await SubscriptionPlan.find({ isActive: true }).sort({ priceMonthly: 1 });
    if (plans.length === 0) {
      for (const p of PLAN_DEFAULTS) {
        await SubscriptionPlan.findOneAndUpdate({ name: p.name }, { $setOnInsert: p }, { upsert: true });
      }
      plans = await SubscriptionPlan.find({ isActive: true }).sort({ priceMonthly: 1 });
    }
    return plans;
  },

  // ── Free/manual upgrade (no payment) ──────────────────────────────────────
  async upgradePlan({ org, planId }) {
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) throw new AppError('Plan not found', 404);

    if (plan.limits.maxBranches !== null && plan.limits.maxBranches !== undefined) {
      const branchCount = await Branch.countDocuments({ organization: org._id, isActive: true });
      if (branchCount > plan.limits.maxBranches) {
        const err = new AppError(
          `You have ${branchCount} active branches but the "${plan.name}" plan allows only ${plan.limits.maxBranches}. Remove branches first to downgrade.`,
          409,
          'BRANCH_LIMIT_EXCEEDED',
        );
        err.details = { currentBranches: branchCount, allowedBranches: plan.limits.maxBranches, planName: plan.name };
        throw err;
      }
    }

    return _activatePlan(org._id, plan);
  },

  // ── Paid plan purchase: wallet-first, Paymob card fallback ───────────────
  async purchasePlan({ org, planId, actor }) {
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) throw new AppError('Plan not found', 404);

    // Branch-limit check (unchanged)
    if (plan.limits.maxBranches != null) {
      const branchCount = await Branch.countDocuments({ organization: org._id, isActive: true });
      if (branchCount > plan.limits.maxBranches) {
        const err = new AppError(
          `You have ${branchCount} active branches but the "${plan.name}" plan allows only ${plan.limits.maxBranches}.`,
          409,
          'BRANCH_LIMIT_EXCEEDED',
        );
        err.details = { currentBranches: branchCount, allowedBranches: plan.limits.maxBranches, planName: plan.name };
        throw err;
      }
    }

    // Free plan — activate immediately
    if (plan.priceMonthly === 0) {
      const sub = await _activatePlan(org._id, plan);
      await _createInvoice(org._id, plan, 0, 'manual');
      return { method: 'free', subscription: sub };
    }

    const wallet  = await walletService.getOrCreateOrgWallet(org._id);
    const balance = wallet?.balance ?? 0;

    // Wallet-sufficient path
    if (balance >= plan.priceMonthly) {
      if (wallet.status !== 'active') {
        throw new AppError('Organization wallet is not active', 402, 'WALLET_INACTIVE');
      }

      const updated = await walletService.planPurchaseDebit({
        orgId:    org._id,
        amount:   plan.priceMonthly,
        planId:   plan._id,
        planName: plan.name,
      });

      const sub     = await _activatePlan(org._id, plan);
      const invoice = await _createInvoice(org._id, plan, plan.priceMonthly, 'wallet');
      return { method: 'wallet', subscription: sub, invoice, walletBalance: updated.balance };
    }

    // Wallet insufficient → tell the client to start a Paymob checkout
    throw new AppError(
      'Insufficient wallet balance. Use the billing checkout endpoint to pay by card.',
      402,
      'INSUFFICIENT_WALLET',
      { walletBalance: balance, planPrice: plan.priceMonthly, planName: plan.name },
    );
  },
  
  // ── Billing history ───────────────────────────────────────────────────────
  async getInvoices({ org, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;
    const [invoices, total] = await Promise.all([
      Invoice.find({ organization: org._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments({ organization: org._id }),
    ]);
    return { invoices, total };
  },
};
