import Payment from '../models/Payment.js';
import Account from '../models/Account.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import { paymobProvider } from './providers/paymob.js';
import { subscriptionService } from './subscriptionService.js';
import { walletService } from './walletService.js';
import { AppError, NotFound } from '../utils/errors.js';

/**
 * Build Paymob billing_data from an Account. Paymob requires ALL these fields
 * (even if "NA") or it rejects the intention.
 */
function billingFromAccount(account) {
  return {
    first_name:   account.fullName?.split(' ')[0]  || 'NA',
    last_name:    account.fullName?.split(' ').slice(1).join(' ') || 'NA',
    email:        account.email        || 'na@example.com',
    phone_number: account.phone        || 'NA',
    country:      'EGY',
    city:         'NA', street: 'NA', building: 'NA', floor: 'NA', apartment: 'NA',
  };
}

export const paymentService = {
  // ── Checkout starters ───────────────────────────────────────────────────

  /**
   * Start a subscription checkout for an organization.
   */
  async startSubscriptionCheckout({ orgId, planId, billingCycle, actor }) {
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) throw NotFound('Plan not found');

    // Compute price
    const monthly = plan.priceMonthly;
    const amount  = billingCycle === 'yearly'
      ? Math.round(monthly * 12 * (1 - (plan.yearlyDiscount || 0) / 100))
      : monthly;
    const amountCents = Math.round(amount * 100);

    // Create pending payment record FIRST so the webhook can find it
    const payment = await Payment.create({
      purpose:      'subscription',
      organization: orgId,
      plan:         planId,
      billingCycle,
      amountCents,
      currency:     plan.currency || 'EGP',
    });

    const { checkoutUrl } = await paymobProvider.createIntention({
      amountCents,
      currency:        plan.currency || 'EGP',
      merchantOrderId: String(payment._id),
      billingData:     billingFromAccount(actor.account),
      items: [{
        name:     `${plan.name} (${billingCycle})`,
        amount:   amountCents,
        quantity: 1,
      }],
    });

    return { checkoutUrl, paymentId: payment._id };
  },

  /**
   * Start a wallet top-up for the authenticated user (patient/doctor).
   */
  async startWalletTopup({ accountId, ownerKind, amount, actor }) {
    const amountCents = Math.round(amount * 100);

    const payment = await Payment.create({
      purpose:     'wallet_topup',
      account:     accountId,
      ownerKind,
      amountCents,
      currency:    'EGP',
    });

    const { checkoutUrl } = await paymobProvider.createIntention({
      amountCents,
      currency:        'EGP',
      merchantOrderId: String(payment._id),
      billingData:     billingFromAccount(actor.account),
      items: [{ name: 'Wallet top-up', amount: amountCents, quantity: 1 }],
    });

    return { checkoutUrl, paymentId: payment._id };
  },

  /**
   * Start an organization wallet top-up (admin).
   */
  async startOrgWalletTopup({ orgId, amount, actor }) {
    const amountCents = Math.round(amount * 100);

    const payment = await Payment.create({
      purpose:      'org_wallet_topup',
      organization: orgId,
      ownerKind:    'organization',
      amountCents,
      currency:     'EGP',
    });

    const { checkoutUrl } = await paymobProvider.createIntention({
      amountCents,
      currency:        'EGP',
      merchantOrderId: String(payment._id),
      billingData:     billingFromAccount(actor.account),
      items: [{ name: 'Organization wallet top-up', amount: amountCents, quantity: 1 }],
    });

    return { checkoutUrl, paymentId: payment._id };
  },

  // ── Webhook handler ─────────────────────────────────────────────────────

  /**
   * Called by the Paymob webhook after HMAC verification.
   * `obj` is the transaction object Paymob sends.
   */
  async handleWebhook(obj) {
    const merchantOrderId = obj?.order?.merchant_order_id;
    if (!merchantOrderId) throw new AppError('Missing merchant_order_id', 400);

    const payment = await Payment.findById(merchantOrderId);
    if (!payment) throw NotFound('Payment record not found');

    // Idempotency — Paymob may retry webhooks
    if (payment.status === 'success') return { alreadyProcessed: true };

    payment.paymobTransactionId = String(obj.id);
    payment.processedAt         = new Date();

    // Failed payment
    if (!obj.success || obj.error_occured) {
      payment.status        = 'failed';
      payment.failureReason = obj.data?.message || 'Payment failed';
      await payment.save();

      // Downgrade the subscription only if this was a renewal attempt.
      if (payment.purpose === 'subscription') {
        await subscriptionService.markPastDue(payment.organization);
      }
      return { ok: true, status: 'failed' };
    }

    // Successful payment — dispatch by purpose
    payment.status = 'success';
    await payment.save();

    switch (payment.purpose) {
      case 'subscription':
        await subscriptionService.activateOrRenew({
          orgId:        payment.organization,
          planId:       payment.plan,
          billingCycle: payment.billingCycle,
          providerRef:  String(obj.id),
        });
        break;

      case 'wallet_topup':
        await walletService.topUp({
          accountId: payment.account,
          ownerKind: payment.ownerKind,
          amount:    payment.amountCents / 100,
        });
        break;

      case 'org_wallet_topup':
        await walletService.orgTopUp({
          orgId:  payment.organization,
          amount: payment.amountCents / 100,
        });
        break;
    }

    return { ok: true, status: 'success' };
  },
};