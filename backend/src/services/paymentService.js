import { env } from '../config/env.js';
import Payment from '../models/Payment.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Appointment from '../models/Appointment.js';
import { paymobProvider } from './providers/paymob.js';
import { subscriptionService } from './subscriptionService.js';
import { AppError, NotFound, Forbidden, Conflict } from '../utils/errors.js';

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

  // Start a subscription checkout for an organization.   
  async startSubscriptionCheckout({ orgId, planId, billingCycle, actor }) {
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) throw NotFound('Plan not found');

    const monthly = plan.priceMonthly;
    const amount  = billingCycle === 'yearly'
      ? Math.round(monthly * 12 * (1 - (plan.yearlyDiscount || 0) / 100))
      : monthly;
    const amountCents = Math.round(amount * 100);

    const payment = await Payment.create({
      purpose:      'subscription',
      organization: orgId,
      plan:         planId,
      billingCycle,
      amountCents,
      currency:     plan.currency || 'EGP',
    });

    const { checkoutUrl, intentionId } = await paymobProvider.createIntention({
      amountCents,
      currency:        plan.currency || 'EGP',
      merchantOrderId: String(payment._id),
      billingData:     billingFromAccount(actor.account),
      items: [{
        name:     `${plan.name} (${billingCycle})`,
        amount:   amountCents,
        quantity: 1,
      }],
      redirectionUrl: `${env.app.url}/payment-result?paymentId=${payment._id}`,
    });

    if (intentionId) {
      payment.paymobIntentionId = String(intentionId);
      await payment.save();
    }

    return { checkoutUrl, paymentId: payment._id };
  },

  // Start an appointment checkout for a patient.
  async startAppointmentCheckout({ appointmentId, actor }) {
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientProfile', 'accountId')
      .populate({
        path: 'session',
        select: 'consultationFee currency doctorBranchSchedule',
        populate: { path: 'doctorBranchSchedule', select: 'consultationFee' },
      });
    if (!appointment) throw NotFound('Appointment not found');

    // Ownership: patient can only pay for their own appointments
    if (String(appointment.patientProfile?.accountId) !== String(actor.account._id)) {
      throw Forbidden('Appointment does not belong to this user');
    }

    // Idempotency
    if (appointment.paymentStatus === 'success') {
      throw Conflict('Appointment is already paid');
    }
    if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
      throw Conflict(`Cannot pay for an appointment in status "${appointment.status}"`);
    }

    // Fee precedence: session.consultationFee > schedule.consultationFee.amount
    const sess = appointment.session;
    let fee = sess?.consultationFee;
    if (!fee || fee <= 0) {
      fee = sess?.doctorBranchSchedule?.consultationFee?.amount;
    }
    if (!fee || fee <= 0) throw new AppError('Session has no consultation fee configured', 400);

    const currency    = sess.currency || sess?.doctorBranchSchedule?.consultationFee?.currency || 'EGP';
    const amountCents = Math.round(fee * 100);

    // If a previous pending payment exists for this appointment, reuse it
    let payment = await Payment.findOne({
      purpose:     'appointment',
      appointment: appointment._id,
      status:      'pending',
    });

    if (!payment) {
      payment = await Payment.create({
        purpose:     'appointment',
        account:     actor.account._id,
        appointment: appointment._id,
        amountCents,
        currency,
      });
    }

    const { checkoutUrl, intentionId } = await paymobProvider.createIntention({
      amountCents,
      currency,
      merchantOrderId: String(payment._id),
      billingData:     billingFromAccount(actor.account),
      items: [{ name: 'Appointment consultation', amount: amountCents, quantity: 1 }],
      redirectionUrl: `${env.app.url}/payment-result?paymentId=${payment._id}`,
    });

    if (intentionId) {
      payment.paymobIntentionId = String(intentionId);
      await payment.save();
    }

    return { checkoutUrl, paymentId: payment._id };
  },

  // Webhook handler

  /**
   * Called by the Paymob webhook after HMAC verification.
   * `obj` is the transaction object Paymob sends.
   */
  async handleWebhook(obj) {
    const merchantOrderId = obj?.order?.merchant_order_id;
    if (!merchantOrderId) throw new AppError('Missing merchant_order_id', 400);

    const payment = await Payment.findById(merchantOrderId);
    if (!payment) throw NotFound('Payment record not found');

    // Idempotency
    if (payment.status === 'success') return { alreadyProcessed: true };

    payment.paymobTransactionId = String(obj.id);
    payment.processedAt         = new Date();

    if (!obj.success || obj.error_occured) {
      payment.status        = 'failed';
      payment.failureReason = obj.data?.message || 'Payment failed';
      await payment.save();

      if (payment.purpose === 'subscription') {
        await subscriptionService.markPastDue(payment.organization);
      }
      return { ok: true, status: 'failed' };
    }

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

      case 'appointment':
        await Appointment.findByIdAndUpdate(payment.appointment, {
          $set: {
            paymentMethod: 'paymob',
            paymentStatus: 'success',
            paidAt:        new Date(),
          },
        });
        break;
    }

    return { ok: true, status: 'success' };
  },
};