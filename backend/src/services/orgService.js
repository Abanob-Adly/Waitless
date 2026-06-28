import Organization from '../models/Organization.js';
import { AdminMembership } from '../models/Membership.js';
import Subscription from '../models/Subscription.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import { getActiveSubscription } from '../utils/subscription.js';
import { tokenService } from './token.js';
import { Conflict, Forbidden } from '../utils/errors.js';

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
      const defaults = [
        {
          name: 'Free Trial',
          description: 'Get started — no credit card required.',
          priceMonthly: 0,
          currency: 'EGP',
          limits: { maxBranches: 1, maxDoctors: 5, maxReceptionists: 2, marketplaceListing: false, whatsappNotifications: false },
          isActive: true,
        },
        {
          name: 'Standard',
          description: 'For growing clinics.',
          priceMonthly: 299,
          yearlyDiscount: 20,
          currency: 'EGP',
          limits: { maxBranches: 3, maxDoctors: 15, maxReceptionists: 10, marketplaceListing: true, whatsappNotifications: true },
          isActive: true,
        },
        {
          name: 'Enterprise',
          description: 'Unlimited scale for hospital networks.',
          priceMonthly: 799,
          yearlyDiscount: 25,
          currency: 'EGP',
          limits: { maxBranches: null, maxDoctors: null, maxReceptionists: null, marketplaceListing: true, whatsappNotifications: true },
          isActive: true,
        },
      ];
      for (const p of defaults) {
        await SubscriptionPlan.findOneAndUpdate({ name: p.name }, { $setOnInsert: p }, { upsert: true });
      }
      plans = await SubscriptionPlan.find({ isActive: true }).sort({ priceMonthly: 1 });
    }
    return plans;
  },

  async upgradePlan({ org, planId }) {
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) throw Forbidden('Plan not found');

    const now = new Date();
    const sub = await Subscription.findOneAndUpdate(
      { organization: org._id },
      {
        $set: {
          plan: plan._id,
          state: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true, new: true }
    ).populate('plan');
    return sub;
  },
};
