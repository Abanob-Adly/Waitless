// controllers/paymentController.js
import { paymentService } from '../services/paymentService.js';
import { paymobProvider } from '../services/providers/paymob.js';
import Payment from '../models/Payment.js';

function ownerKindFromReq(req) {
  return req.actor.account.role === 'patient' ? 'patient' : 'doctor';
}   

export const paymentController = {
  // POST /billing/checkout   { planId, billingCycle }
  async subscriptionCheckout(req, res, next) {
    try {
      const { planId, billingCycle = 'monthly' } = req.body;
      if (!planId) return res.status(400).json({ status: 'error', message: 'planId is required' });
      if (!['monthly', 'yearly'].includes(billingCycle)) {
        return res.status(400).json({ status: 'error', message: 'billingCycle must be monthly or yearly' });
      }

      const result = await paymentService.startSubscriptionCheckout({
        orgId: req.params.orgId,
        planId,
        billingCycle,
        actor: req.actor,
      });
      res.json({ data: result });
    } catch (err) { next(err); }
  },

  // POST /wallets/me/topup   { amount }   (replaces the old direct-credit topup)
  async walletTopup(req, res, next) {
    try {
      const amount = Number(req.body.amount);
      if (!amount || amount <= 0 || amount > 50_000) {
        return res.status(400).json({ status: 'error', message: 'Amount must be between 1 and 50,000 EGP' });
      }
      const result = await paymentService.startWalletTopup({
        accountId: req.actor.account._id,
        ownerKind: ownerKindFromReq(req),
        amount,
        actor:     req.actor,
      });
      res.json({ data: result });
    } catch (err) { next(err); }
  },

  // POST /organizations/:orgId/wallet/topup   { amount }
  async orgWalletTopup(req, res, next) {
    try {
      const amount = Number(req.body.amount);
      if (!amount || amount <= 0 || amount > 500_000) {
        return res.status(400).json({ status: 'error', message: 'Amount must be between 1 and 500,000 EGP' });
      }
      const result = await paymentService.startOrgWalletTopup({
        orgId:  req.params.orgId,
        amount,
        actor:  req.actor,
      });
      res.json({ data: result });
    } catch (err) { next(err); }
  },

  // GET /payments/result?paymentId=...    (frontend lands here after checkout)
  async result(req, res, next) {
    try {
      const payment = await Payment.findById(req.query.paymentId);
      if (!payment) return res.status(404).json({ status: 'error', message: 'Payment not found' });
      res.json({
        data: {
          status:      payment.status,
          purpose:     payment.purpose,
          amountCents: payment.amountCents,
          currency:    payment.currency,
        },
      });
    } catch (err) { next(err); }
  },

  // POST /webhooks/paymob   (public — Paymob authenticates via HMAC)
  async paymobWebhook(req, res, next) {
    try {
      const obj  = req.body?.obj;
      const hmac = req.query.hmac || req.body?.hmac;

      if (!obj) return res.status(400).send('Missing obj');
      if (!paymobProvider.verifyHmac(obj, hmac)) {
        return res.status(401).send('Invalid HMAC');
      }

      await paymentService.handleWebhook(obj);
      // Paymob only cares about a 2xx response — reply fast.
      res.sendStatus(200);
    } catch (err) {
      // Log the failure but still 200 to prevent Paymob from retrying forever
      // during dev. Adjust if you'd rather have retries.
      console.error('[Paymob webhook] Error:', err);
      res.sendStatus(200);
    }
  },
};