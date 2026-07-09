import mongoose from 'mongoose';
import { paymentService } from '../services/paymentService.js';
import { paymobProvider } from '../services/providers/paymob.js';
import Payment from '../models/Payment.js';

/**
 * A payment is visible to:
 *   - the account that initiated it (appointment payments)
 *   - any active admin of the organization it belongs to (subscription)
 *   - platform admins
 */
function isPaymentOwner(payment, actor) {
  if (!actor?.account?._id) return false;
  if (actor.isPlatformAdmin) return true;

  if (payment.account && String(payment.account) === String(actor.account._id)) {
    return true;
  }

  if (payment.organization) {
    const sameOrg = actor.activeOrgId
      && String(actor.activeOrgId) === String(payment.organization);
    const isAdmin = actor.activeMembership?.kind === 'admin';
    if (sameOrg && isAdmin) return true;
  }

  return false;
}

export const paymentController = {
  // POST /orgs/:orgId/billing/checkout   { planId, billingCycle }
  async subscriptionCheckout(req, res, next) {
    try {
      const { planId, billingCycle = 'monthly' } = req.body;
      if (!planId) {
        return res.status(400).json({ status: 'error', message: 'planId is required' });
      }
      if (!['monthly', 'yearly'].includes(billingCycle)) {
        return res.status(400).json({ status: 'error', message: 'billingCycle must be monthly or yearly' });
      }

      const result = await paymentService.startSubscriptionCheckout({
        orgId:        req.params.orgId,
        planId,
        billingCycle,
        actor:        req.actor,
      });
      res.json({ data: result });
    } catch (err) { next(err); }
  },

  // POST /appointments/:appointmentId/pay
  async appointmentCheckout(req, res, next) {
    try {
      const { appointmentId } = req.params;
      if (!mongoose.isValidObjectId(appointmentId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid appointmentId' });
      }

      const result = await paymentService.startAppointmentCheckout({
        appointmentId,
        actor: req.actor,
      });
      res.json({ data: result });
    } catch (err) { next(err); }
  },

  // GET /*/result?paymentId=...
  async result(req, res, next) {
    try {
      const { paymentId } = req.query;
      if (!paymentId) {
        return res.status(400).json({ status: 'error', message: 'paymentId is required' });
      }
      if (!mongoose.isValidObjectId(paymentId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid paymentId' });
      }

      const payment = await Payment.findById(paymentId).lean();
      if (!payment) {
        return res.status(404).json({ status: 'error', message: 'Payment not found' });
      }

      if (!isPaymentOwner(payment, req.actor)) {
        // 404 (not 403) to prevent payment-id enumeration
        return res.status(404).json({ status: 'error', message: 'Payment not found' });
      }

      let appointmentToken;
      if (payment.purpose === 'appointment' && payment.appointment) {
        const appointment = await mongoose.model('Appointment').findById(payment.appointment).select('accessToken').lean();
        appointmentToken = appointment?.accessToken ?? null;
      }

      res.json({
        data: {
          id:               String(payment._id),
          status:           payment.status,
          purpose:          payment.purpose,
          amountCents:      payment.amountCents,
          currency:         payment.currency,
          processedAt:      payment.processedAt,
          failureReason:    payment.status === 'failed' ? payment.failureReason : undefined,
          appointment:      payment.purpose === 'appointment' ? String(payment.appointment) : undefined,
          appointmentToken: appointmentToken ?? undefined,
        },
      });
    } catch (err) { next(err); }
  },

  // POST /webhooks/paymob   (public — Paymob authenticates via HMAC)
  async paymobWebhook(req, res) {
    try {
      const obj  = req.body?.obj;
      const hmac = req.query.hmac || req.body?.hmac;

      if (!obj) return res.status(400).send('Missing obj');
      if (!paymobProvider.verifyHmac(obj, hmac)) {
        return res.status(401).send('Invalid HMAC');
      }

      await paymentService.handleWebhook(obj);
      res.sendStatus(200);
    } catch (err) {
      console.error('[Paymob webhook] Error:', err);
      // 500, not 200 — a 200 here told Paymob the webhook was fully processed
      // even when it wasn't (e.g. a transient DB error), so it would never
      // retry and a real payment could silently fail to activate anything.
      // Returning 500 lets Paymob's own retry mechanism recover it.
      res.sendStatus(500);
    }
  },
};