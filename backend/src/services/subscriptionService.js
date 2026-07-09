import Subscription from '../models/Subscription.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Invoice from '../models/Invoice.js';
import { NotFound } from '../utils/errors.js';

function addPeriod(from, cycle) {
  const d = new Date(from);
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else                    d.setMonth(d.getMonth() + 1);
  return d;
}

export const subscriptionService = {
  /**
   * Get the current billable subscription for an org (trial/active/past_due).
   */
  async getActive(orgId) {
    return Subscription.findOne({
      organization: orgId,
      state: { $in: ['trial', 'active', 'past_due'] },
    }).populate('plan');
  },

  /**
   * Called by the Paymob webhook when a subscription payment succeeds.
   * Creates a new subscription or extends the existing one.
   */
  async activateOrRenew({ orgId, planId, billingCycle, providerRef, amountCents }) {
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) throw NotFound('Plan not found');

    const existing = await this.getActive(orgId);
    const now = new Date();

    let subscription;

    // Same plan renewal → extend from whichever is later (now or currentPeriodEnd)
    if (existing && String(existing.plan._id) === String(planId)) {
      const from = existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
      existing.currentPeriodStart      = existing.currentPeriodStart || now;
      existing.currentPeriodEnd        = addPeriod(from, billingCycle);
      existing.state                   = 'active';
      existing.billingCycle            = billingCycle;
      existing.provider                = 'paymob';
      existing.providerSubscriptionId  = providerRef;
      existing.cancelAtPeriodEnd       = false;
      existing.cancelledAt             = null;
      await existing.save();
      subscription = existing;
    } else {
      // Plan change → cancel the old one, create a fresh subscription
      if (existing) {
        existing.state       = 'cancelled';
        existing.cancelledAt = now;
        await existing.save();
      }

      subscription = await Subscription.create({
        organization:           orgId,
        plan:                   planId,
        state:                  'active',
        billingCycle,
        currentPeriodStart:     now,
        currentPeriodEnd:       addPeriod(now, billingCycle),
        provider:               'paymob',
        providerSubscriptionId: providerRef,
      });
    }

    // Every real (Paymob) charge gets a billing-history record — this was
    // previously only done for wallet/manual activation in orgService,
    // so Paymob-paid plans (the primary payment gate) never showed up here.
    await Invoice.create({
      organization:        orgId,
      plan:                planId,
      planName:            plan.name,
      amount:              (amountCents ?? 0) / 100,
      currency:            plan.currency || 'EGP',
      paymentMethod:       'paymob',
      paymobTransactionId: providerRef,
      status:              'paid',
      periodStart:         subscription.currentPeriodStart,
      periodEnd:           subscription.currentPeriodEnd,
    });

    return subscription;
  },

  /**
   * Mark subscription as past_due (called on payment failure webhook).
   */
  async markPastDue(orgId) {
    return Subscription.findOneAndUpdate(
      { organization: orgId, state: 'active' },
      { $set: { state: 'past_due' } },
      { new: true },
    );
  },
};