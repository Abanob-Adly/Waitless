import cron from 'node-cron';
import Session from '../models/QueueSession.js';
import { Membership } from '../models/Membership.js';
import { walletService } from '../services/walletService.js';

const GRACE_PERIOD_MIN = 15;
const PENALTY_AMOUNT   = 200;

/**
 * Runs every 5 minutes.
 * Finds sessions that:
 *  - are still 'scheduled' (never started)
 *  - started more than GRACE_PERIOD_MIN ago
 *  - have no approved excuse
 *  - haven't had a penalty applied yet
 * Deducts PENALTY_AMOUNT EGP from the doctor's wallet and records it on the session.
 */
export function startLateStartPenaltyCron() {
  cron.schedule('*/5 * * * *', async () => {
    const now       = new Date();
    const cutoff    = new Date(now.getTime() - GRACE_PERIOD_MIN * 60_000);

    let sessions;
    try {
      sessions = await Session.find({
        status:    'scheduled',
        startTime: { $lt: cutoff },
        'penaltyApplied.appliedAt': { $exists: false },
        $or: [
          { 'excuse.status': { $ne: 'approved' } },
          { 'excuse.status': { $exists: false } },
          { excuse: null },
        ],
      }).lean();
    } catch (err) {
      console.error('[lateStartPenalty] DB query failed:', err.message);
      return;
    }

    for (const session of sessions) {
      try {
        const mem = await Membership.findById(session.doctor).select('account').lean();
        if (!mem?.account) continue;

        await walletService.penaltyDebit({
          accountId: String(mem.account),
          amount:    PENALTY_AMOUNT,
          sessionId: session._id,
        });

        await Session.findByIdAndUpdate(session._id, {
          $set: {
            'penaltyApplied.amount':    PENALTY_AMOUNT,
            'penaltyApplied.appliedAt': now,
          },
        });

        console.log(`[lateStartPenalty] Applied ${PENALTY_AMOUNT} EGP penalty to session ${session._id}`);
      } catch (err) {
        console.warn(`[lateStartPenalty] Failed for session ${session._id}:`, err.message);
      }
    }
  });
}
