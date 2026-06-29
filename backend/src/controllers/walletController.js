import { walletService } from '../services/walletService.js';
import Wallet from '../models/Wallet.js';
import { Membership } from '../models/Membership.js';
import Appointment from '../models/Appointment.js';

/**
 * Resolve the personal wallet for the authenticated user.
 * For patients ownerKind = 'patient'; for staff/doctors ownerKind = 'doctor'.
 * Uses req.actor set by the authenticate middleware (not req.user).
 */
function ownerKindFromReq(req) {
  return req.actor.account.role === 'patient' ? 'patient' : 'doctor';
}

export const walletController = {
  // ── Personal wallet (patient / doctor) ──────────────────────────────────────

  async getMyWallet(req, res) {
    const wallet = await walletService.getOrCreateAccountWallet(
      req.actor.account._id,
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
      accountId: req.actor.account._id,
      ownerKind: ownerKindFromReq(req),
      amount,
    });
    res.json({ data: { wallet: serializeWallet(wallet) } });
  },

  async purchaseAtBooking(req, res, next) {
    try {
      const accountId = req.actor.account._id;
      const { appointmentId, amount } = req.body;

      if (!appointmentId) return res.status(400).json({ status: 'error', message: 'appointmentId is required' });
      const fee = Number(amount);
      if (!fee || fee <= 0) return res.status(400).json({ status: 'error', message: 'Invalid amount' });

      // Verify the appointment belongs to this patient's profile
      const appointment = await Appointment.findById(appointmentId).populate('patientProfile', 'accountId').lean();
      if (!appointment) return res.status(404).json({ status: 'error', message: 'Appointment not found' });
      if (String(appointment.patientProfile?.accountId) !== String(accountId)) {
        return res.status(403).json({ status: 'error', message: 'Appointment does not belong to this user' });
      }

      const wallet = await walletService.purchaseDebit({ accountId, amount: fee, appointmentId });

      // Mark appointment as prepaid via wallet so queueService skips the auto-debit at completion
      await Appointment.findByIdAndUpdate(appointmentId, {
        $set: { paymentMethod: 'wallet', paymentStatus: 'success' },
      });

      res.json({ status: 'ok', data: { wallet: serializeWallet(wallet) } });
    } catch (err) {
      next(err);
    }
  },

  async getMyEntries(req, res) {
    const { limit = 50, page = 1 } = req.query;
    const wallet = await walletService.getOrCreateAccountWallet(
      req.actor.account._id,
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
