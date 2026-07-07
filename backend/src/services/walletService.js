import Wallet from '../models/Wallet.js';
import WalletEntry from '../models/WalletEntry.js';

/**
 * Find or create the wallet for an organization.
 * Atomic upsert prevents race-condition duplicates.
 */
async function getOrCreateOrgWallet(orgId) {
  return Wallet.findOneAndUpdate(
    { organization: orgId },
    { $setOnInsert: { organization: orgId, balance: 0, status: 'active', currency: 'EGP' } },
    { upsert: true, new: true },
  );
}

/**
 * Atomically debit a wallet. Returns the updated wallet doc.
 * Throws if the wallet is frozen/closed or has insufficient funds.
 */
async function debitWallet(walletId, amount, entryMeta) {
  const wallet = await Wallet.findOneAndUpdate(
    { _id: walletId, status: 'active', balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true },
  );
  if (!wallet) {
    const w = await Wallet.findById(walletId);
    if (!w || w.status !== 'active') throw new Error('Wallet is frozen or closed');
    throw new Error('Insufficient wallet balance');
  }
  await WalletEntry.create({
    wallet:       wallet._id,
    direction:    'debit',
    amount,
    balanceAfter: wallet.balance,
    status:       'settled',
    ...entryMeta,
  });
  return wallet;
}

async function creditWallet(walletId, amount, entryMeta) {
  const wallet = await Wallet.findByIdAndUpdate(
    walletId,
    { $inc: { balance: amount } },
    { new: true },
  );
  if (!wallet) throw new Error(`Wallet ${walletId} not found`);
  await WalletEntry.create({
    wallet:       wallet._id,
    direction:    'credit',
    amount,
    balanceAfter: wallet.balance,
    status:       'settled',
    ...entryMeta,
  });
  return wallet;
}

export const walletService = {
  getOrCreateOrgWallet,
  debitWallet,
  creditWallet,

  /**
   * Credit an organization's wallet with its commission share of an appointment.
   * Called only from the appointment settlement path (queueService / paymentService).
   */
  async orgCommissionCredit({ orgId, amount, appointmentId }) {
    const wallet = await getOrCreateOrgWallet(orgId);
    return creditWallet(wallet._id, amount, {
      type:          'commission',
      reference:     appointmentId,
      referenceKind: 'appointment',
      description:   'Organization commission share',
    });
  },

  /**
   * Debit the organization wallet for a subscription plan purchase.
   * Called from orgService.purchasePlan when balance is sufficient.
   */
  async planPurchaseDebit({ orgId, amount, planId, planName }) {
    const wallet = await getOrCreateOrgWallet(orgId);
    return debitWallet(wallet._id, amount, {
      type:          'plan_purchase',
      reference:     planId,
      referenceKind: 'plan',
      description:   `Plan subscription: ${planName}`,
    });
  },

  async getEntries({ walletId, limit = 50, page = 1 }) {
    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      WalletEntry.find({ wallet: walletId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      WalletEntry.countDocuments({ wallet: walletId }),
    ]);
    return { entries, total };
  },
};