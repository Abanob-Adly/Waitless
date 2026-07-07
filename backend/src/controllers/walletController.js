import { walletService } from '../services/walletService.js';

function serializeWallet(w) {
  return {
    id:        String(w._id),
    balance:   w.balance,
    currency:  w.currency,
    status:    w.status,
    updatedAt: w.updatedAt,
  };
}

function serializeEntry(e) {
  return {
    id:            String(e._id),
    type:          e.type,
    direction:     e.direction,
    amount:        e.amount,
    balanceAfter:  e.balanceAfter,
    description:   e.description,
    status:        e.status,
    createdAt:     e.createdAt,
    referenceKind: e.referenceKind,
  };
}

export const walletController = {
  async getOrgWallet(req, res, next) {
    try {
      const wallet = await walletService.getOrCreateOrgWallet(req.params.orgId);
      res.json({ data: { wallet: serializeWallet(wallet) } });
    } catch (err) { next(err); }
  },

  async getOrgEntries(req, res, next) {
    try {
      const { limit = 50, page = 1 } = req.query;
      const wallet = await walletService.getOrCreateOrgWallet(req.params.orgId);
      const { entries, total } = await walletService.getEntries({
        walletId: wallet._id,
        limit,
        page,
      });
      res.json({
        data: {
          entries: entries.map(serializeEntry),
          total,
          page:  Number(page),
          limit: Number(limit),
        },
      });
    } catch (err) { next(err); }
  },
};