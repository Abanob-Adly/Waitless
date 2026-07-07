import Wallet from '../models/Wallet.js';
import WalletEntry from '../models/WalletEntry.js';
import {
  CANCELLATION_PENALTY_EGP as _CANCELLATION_PENALTY,
  SESSION_CLOSURE_FEE_EGP,
} from '../config/fees.js';

// Re-export so callers that already import from this file keep working.
export const CANCELLATION_PENALTY_EGP = _CANCELLATION_PENALTY;

/**
 * Find or create a personal wallet for an account (patient or doctor).
 * Uses atomic upsert to prevent race-condition duplicate wallets.
 */
async function getOrCreateAccountWallet(accountId, ownerKind) {
  return Wallet.findOneAndUpdate(
    { account: accountId },
    { $setOnInsert: { account: accountId, ownerKind, balance: 0, currency: 'EGP', status: 'active' } },
    { new: true, upsert: true },
  );
}

/**
 * Find or create an organization wallet.
 * Uses atomic upsert to prevent race-condition duplicate wallets.
 */
async function getOrCreateOrgWallet(orgId) {
  return Wallet.findOneAndUpdate(
    { organization: orgId },
    { $setOnInsert: { organization: orgId, ownerKind: 'organization', balance: 0, status: 'active', currency: 'EGP' } },
    { upsert: true, new: true },
  );
}

/**
 * Atomically debit a wallet. Returns the updated wallet doc.
 * Throws if the wallet is frozen or has insufficient funds.
 */
async function debitWallet(walletId, amount, entryMeta) {
  const wallet = await Wallet.findOneAndUpdate(
    { _id: walletId, status: 'active', balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true },
  );
  if (!wallet) {
    // Distinguish between frozen and insufficient funds
    const w = await Wallet.findById(walletId);
    if (!w || w.status !== 'active') throw new Error('Wallet is frozen or closed');
    throw new Error('Insufficient wallet balance');
  }
  await WalletEntry.create({
    wallet: wallet._id,
    direction: 'debit',
    amount,
    balanceAfter: wallet.balance,
    status: 'settled',
    ...entryMeta,
  });
  return wallet;
}

/**
 * Atomically credit a wallet. Creates the wallet if it doesn't exist.
 */
async function creditWallet(walletId, amount, entryMeta) {
  const wallet = await Wallet.findByIdAndUpdate(
    walletId,
    { $inc: { balance: amount } },
    { new: true },
  );
  if (!wallet) throw new Error(`Wallet ${walletId} not found`);
  await WalletEntry.create({
    wallet: wallet._id,
    direction: 'credit',
    amount,
    balanceAfter: wallet.balance,
    status: 'settled',
    ...entryMeta,
  });
  return wallet;
}

export const walletService = {
  getOrCreateAccountWallet,
  getOrCreateOrgWallet,

  /**
   * Debit the patient's wallet for a session purchase.
   * Creates the wallet automatically if it doesn't exist yet.
   */
  async purchaseDebit({ accountId, amount, appointmentId }) {
    const wallet = await getOrCreateAccountWallet(accountId, 'patient');
    return debitWallet(wallet._id, amount, {
      type: 'purchase',
      reference: appointmentId,
      referenceKind: 'appointment',
      description: 'Session consultation fee',
    });
  },

  /**
   * Credit a doctor's personal wallet with their net earnings.
   */
  async doctorEarningCredit({ accountId, amount, appointmentId }) {
    const wallet = await getOrCreateAccountWallet(accountId, 'doctor');
    return creditWallet(wallet._id, amount, {
      type: 'earning',
      reference: appointmentId,
      referenceKind: 'appointment',
      description: 'Doctor consultation earnings',
    });
  },

  /**
   * Credit the organization wallet with its commission share.
   */
  async orgCommissionCredit({ orgId, amount, appointmentId }) {
    const wallet = await getOrCreateOrgWallet(orgId);
    return creditWallet(wallet._id, amount, {
      type: 'commission',
      reference: appointmentId,
      referenceKind: 'appointment',
      description: 'Organization commission share',
    });
  },

  /**
   * Top-up a personal wallet by `amount` (no validation — always succeeds).
   */
  /**
   * Deduct a late-start penalty from a doctor's wallet.
   * Unlike purchaseDebit, this does NOT require sufficient balance — the wallet
   * may go negative to ensure the penalty is always recorded.
   */
  async penaltyDebit({ accountId, amount, sessionId }) {
    const wallet = await getOrCreateAccountWallet(accountId, 'doctor');
    // Bypass the balance-check by using a raw $inc without a floor guard.
    const updated = await (await import('../models/Wallet.js')).default.findOneAndUpdate(
      { _id: wallet._id, status: 'active' },
      { $inc: { balance: -amount } },
      { new: true },
    );
    if (!updated) throw new Error('Doctor wallet is frozen or closed');
    const WalletEntry = (await import('../models/WalletEntry.js')).default;
    await WalletEntry.create({
      wallet:        updated._id,
      type:          'penalty',
      direction:     'debit',
      amount,
      balanceAfter:  updated.balance,
      reference:     sessionId,
      referenceKind: 'session',
      description:   'Late-start penalty deduction',
      status:        'settled',
    });
    return updated;
  },

  /**
   * Deduct a cancellation penalty from a patient's wallet.
   * Bypasses the balance floor — allows the wallet to go negative so the
   * cancellation is never blocked by a zero balance.
   * Returns { wallet, amount } so callers can surface the deducted amount.
   */
  async cancellationPenalty({ accountId, appointmentId, amount = CANCELLATION_PENALTY_EGP }) {
    const wallet = await getOrCreateAccountWallet(accountId, 'patient');
    const updated = await Wallet.findOneAndUpdate(
      { _id: wallet._id, status: 'active' },
      { $inc: { balance: -amount } },
      { new: true },
    );
    if (!updated) throw new Error('Patient wallet is not active');
    await WalletEntry.create({
      wallet:        wallet._id,
      type:          'cancellation_penalty',
      direction:     'debit',
      amount,
      balanceAfter:  updated.balance,
      reference:     appointmentId,
      referenceKind: 'appointment',
      description:   `Late cancellation fee (${amount} EGP)`,
      status:        'settled',
    });
    return { wallet: updated, amount };
  },

  /**
   * Charge a patient the session-closure fee and, if they paid upfront, refund
   * the remainder.  Two wallet entries are created so the patient's statement
   * clearly shows both the fee and the partial refund.
   *
   * Returns { feeAmount, refundAmount } — both may be 0 if the patient never
   * paid (e.g. pay-at-desk walk-in whose payment wasn't confirmed yet).
   */
  async sessionClosureCharge({ accountId, appointmentId, paidAmount = 0, sessionId }) {
    const wallet = await getOrCreateAccountWallet(accountId, 'patient');

    const feeAmount = SESSION_CLOSURE_FEE_EGP;
    const refundAmount = Math.max(0, paidAmount - feeAmount);

    // Debit the fee regardless of balance (penalty — allowed to go negative).
    const afterFee = await Wallet.findOneAndUpdate(
      { _id: wallet._id, status: 'active' },
      { $inc: { balance: -feeAmount } },
      { new: true },
    );
    if (!afterFee) throw new Error('Patient wallet is not active');
    await WalletEntry.create({
      wallet:        wallet._id,
      type:          'session_closure_fee',
      direction:     'debit',
      amount:        feeAmount,
      balanceAfter:  afterFee.balance,
      reference:     appointmentId,
      referenceKind: 'appointment',
      description:   `Session closure fee (${feeAmount} EGP retained)`,
      status:        'settled',
    });

    // Credit the refund only when something was paid upfront.
    if (refundAmount > 0) {
      const afterRefund = await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: refundAmount } },
        { new: true },
      );
      if (afterRefund) {
        await WalletEntry.create({
          wallet:        wallet._id,
          type:          'session_closure_refund',
          direction:     'credit',
          amount:        refundAmount,
          balanceAfter:  afterRefund.balance,
          reference:     sessionId,
          referenceKind: 'session',
          description:   `Session closure refund (${refundAmount} EGP returned)`,
          status:        'settled',
        });
      }
    }

    return { feeAmount, refundAmount };
  },

  async topUp({ accountId, ownerKind, amount }) {
    const wallet = await getOrCreateAccountWallet(accountId, ownerKind);
    return creditWallet(wallet._id, amount, {
      type: 'topup',
      referenceKind: 'topup',
      description: 'Wallet top-up',
    });
  },

  async withdraw({ accountId, ownerKind, amount, destination }) {
    const wallet = await getOrCreateAccountWallet(accountId, ownerKind);
    return debitWallet(wallet._id, amount, {
      type: 'withdrawal',
      referenceKind: 'withdrawal',
      description: `Withdrawal to: ${destination}`,
    });
  },

  /**
   * Top-up an organization wallet.
   */
  async orgTopUp({ orgId, amount }) {
    const wallet = await getOrCreateOrgWallet(orgId);
    return creditWallet(wallet._id, amount, {
      type: 'topup',
      referenceKind: 'topup',
      description: 'Organization wallet top-up',
    });
  },

  async getEntries({ walletId, limit = 50, page = 1 }) {
    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      WalletEntry.find({ wallet: walletId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      WalletEntry.countDocuments({ wallet: walletId }),
    ]);
    return { entries, total };
  },
};
