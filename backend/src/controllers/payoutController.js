import { payoutService } from '../services/payoutService.js';

export const payoutController = {
  async requestWithdrawal(req, res, next) {
    try {
      const { amount, destinationType, destinationDetails } = req.body;
      if (!amount || amount < 100) {
        return res.status(400).json({ status: 'error', message: 'Minimum withdrawal is 100 EGP' });
      }
      if (!destinationType || !destinationDetails) {
        return res.status(400).json({ status: 'error', message: 'destinationType and destinationDetails are required' });
      }
      const result = await payoutService.requestWithdrawal({
        orgId: req.params.orgId,
        actorId: req.actor.account._id,
        amount,
        destinationType,
        destinationDetails,
      });
      res.status(201).json({ data: result });
    } catch (err) { next(err); }
  },

  async listOrgPayouts(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await payoutService.listOrgPayouts({ orgId: req.params.orgId, page, limit });
      res.json({ data: result });
    } catch (err) { next(err); }
  },

  async listAllPayouts(req, res, next) {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const result = await payoutService.listAllPayouts({ status, page, limit });
      res.json({ data: result });
    } catch (err) { next(err); }
  },

  async processPayout(req, res, next) {
    try {
      const { status, notes } = req.body;
      if (!status || !['completed', 'rejected'].includes(status)) {
        return res.status(400).json({ status: 'error', message: 'status must be "completed" or "rejected"' });
      }
      const result = await payoutService.processPayout({
        payoutId: req.params.payoutId,
        actorId: req.actor.account._id,
        status,
        notes,
      });
      res.json({ data: result });
    } catch (err) { next(err); }
  },
};
