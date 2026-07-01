import Wallet from '../models/Wallet.js';
import WalletEntry from '../models/WalletEntry.js';

/**
 * Find or create a personal wallet for an account (patient or doctor).
 */
async function getOrCreateAccountWallet(accountId, ownerKind) {
  const existing = await Wallet.findOne({ account: accountId });
  if (existing) return existing;
  return Wallet.create({ account: accountId, ownerKind, balance: 0 });
}

/**
 * Find or create an organization wallet.
 */
async function getOrCreateOrgWallet(orgId) {
  const existing = await Wallet.findOne({ organization: orgId });
  if (existing) return existing;
  return Wallet.create({ organization: orgId, ownerKind: 'organization', balance: 0 });
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

  async topUp({ accountId, ownerKind, amount }) {
    const wallet = await getOrCreateAccountWallet(accountId, ownerKind);
    return creditWallet(wallet._id, amount, {
      type: 'topup',
      referenceKind: 'topup',
      description: 'Wallet top-up',
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
