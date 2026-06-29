import { walletService } from '../services/walletService.js';
import Wallet from '../models/Wallet.js';
import { Membership } from '../models/Membership.js';

/**
 * Resolve the personal wallet for the authenticated user.
 * For staff/doctors, ownerKind = 'doctor'; for patients, ownerKind = 'patient'.
 */
function ownerKindFromReq(req) {
  return req.user?.role === 'patient' ? 'patient' : 'doctor';
}

export const walletController = {
  // ── Personal wallet (patient / doctor) ──────────────────────────────────────

  async getMyWallet(req, res) {
    const wallet = await walletService.getOrCreateAccountWallet(
      req.user.accountId,
      ownerKindFromReq(req),
    );
    res.json({ data: { wallet: serializeWallet(wallet) } });
  },

  async topUp(req, res) {
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0 || amount > 50_000) {
      return res.status(400).json({ status: 'error', message: 'Amount must be between 1 and 50,000 EGP' });
    }
    const wallet = await walletService.topUp({
      accountId: req.user.accountId,
      ownerKind: ownerKindFromReq(req),
      amount,
    });
    res.json({ data: { wallet: serializeWallet(wallet) } });
  },

  async getMyEntries(req, res) {
    const { limit = 50, page = 1 } = req.query;
    const wallet = await walletService.getOrCreateAccountWallet(
      req.user.accountId,
      ownerKindFromReq(req),
    );
    const { entries, total } = await walletService.getEntries({ walletId: wallet._id, limit, page });
    res.json({ data: { entries: entries.map(serializeEntry), total, page: Number(page), limit: Number(limit) } });
  },

  // ── Organization wallet (admin only) ────────────────────────────────────────

  async getOrgWallet(req, res) {
    const wallet = await walletService.getOrCreateOrgWallet(req.params.orgId);
    res.json({ data: { wallet: serializeWallet(wallet) } });
  },

  async topUpOrg(req, res) {
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0 || amount > 500_000) {
      return res.status(400).json({ status: 'error', message: 'Amount must be between 1 and 500,000 EGP' });
    }
    const wallet = await walletService.orgTopUp({ orgId: req.params.orgId, amount });
    res.json({ data: { wallet: serializeWallet(wallet) } });
  },

  async getOrgEntries(req, res) {
    const { limit = 50, page = 1 } = req.query;
    const wallet = await walletService.getOrCreateOrgWallet(req.params.orgId);
    const { entries, total } = await walletService.getEntries({ walletId: wallet._id, limit, page });
    res.json({ data: { entries: entries.map(serializeEntry), total, page: Number(page), limit: Number(limit) } });
  },
};

function serializeWallet(w) {
  return {
    id:           String(w._id),
    balance:      w.balance,
    currency:     w.currency,
    ownerKind:    w.ownerKind,
    status:       w.status,
    updatedAt:    w.updatedAt,
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
