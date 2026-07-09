import PayoutRequest from '../models/PayoutRequest.js';
import { walletService } from './walletService.js';
import { AppError, NotFound } from '../utils/errors.js';

export const payoutService = {
  async requestWithdrawal({ orgId, actorId, amount, destinationType, destinationDetails }) {
    const wallet = await walletService.getOrCreateOrgWallet(orgId);
    if (wallet.balance < amount) {
      throw new AppError('Insufficient wallet balance', 400, 'INSUFFICIENT_WALLET');
    }
    if (wallet.status !== 'active') {
      throw new AppError('Wallet is not active', 400, 'WALLET_INACTIVE');
    }

    return PayoutRequest.create({
      organization: orgId,
      requestedBy: actorId,
      amount,
      currency: 'EGP',
      destinationType,
      destinationDetails,
      status: 'pending',
    });
  },

  async listOrgPayouts({ orgId, page = 1, limit = 20 }) {
    const skip = (Number(page) - 1) * Number(limit);
    const [payouts, total] = await Promise.all([
      PayoutRequest.find({ organization: orgId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      PayoutRequest.countDocuments({ organization: orgId }),
    ]);
    return { payouts, total, page: Number(page), limit: Number(limit) };
  },

  async listAllPayouts({ status, page = 1, limit = 20 }) {
    const filter = status ? { status } : {};
    const skip = (Number(page) - 1) * Number(limit);
    const [payouts, total] = await Promise.all([
      PayoutRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('organization', 'name')
        .populate('requestedBy', 'fullName email')
        .lean(),
      PayoutRequest.countDocuments(filter),
    ]);
    return { payouts, total, page: Number(page), limit: Number(limit) };
  },

  async processPayout({ payoutId, actorId, status, notes }) {
    const payout = await PayoutRequest.findById(payoutId);
    if (!payout) throw NotFound('Payout request not found');
    if (payout.status !== 'pending') {
      throw new AppError('Payout request already processed', 409);
    }

    if (status === 'completed') {
      const entry = await walletService.withdrawalDebit({
        orgId: payout.organization,
        amount: payout.amount,
        payoutRequestId: payout._id,
      });
      payout.walletEntry = entry._id;
    }

    payout.status = status;
    payout.processedBy = actorId;
    payout.processedAt = new Date();
    payout.notes = notes || '';
    await payout.save();
    return payout;
  },
};
