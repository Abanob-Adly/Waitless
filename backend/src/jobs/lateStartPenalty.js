import cron from 'node-cron';
import Session from '../models/QueueSession.js';
import { Membership } from '../models/Membership.js';
import { walletService } from '../services/walletService.js';
import {
  LATE_START_GRACE_MIN as GRACE_PERIOD_MIN,
  LATE_START_PENALTY_EGP as PENALTY_AMOUNT,
} from '../config/fees.js';

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
      // Case 1: Sessions that never started past the grace period
      const neverStarted = await Session.find({
        status:    'scheduled',
        startTime: { $lt: cutoff },
        'penaltyApplied.appliedAt': { $exists: false },
        $or: [
          { 'excuse.status': { $ne: 'approved' } },
          { 'excuse.status': { $exists: false } },
          { excuse: null },
        ],
      }).lean();

      // Case 2: Sessions that started significantly late and were already activated,
      // but the penalty hasn't been applied and no approved excuse exists.
      // Threshold reuses GRACE_PERIOD_MIN so ~1 minute of auto-start cron jitter
      // (sessionAutoStart.js) never counts as a doctor-caused late start.
      const startedLate = await Session.find({
        status:      'active',
        lateStartMin: { $gt: GRACE_PERIOD_MIN },
        'penaltyApplied.appliedAt': { $exists: false },
        $or: [
          { 'excuse.status': { $ne: 'approved' } },
          { 'excuse.status': { $exists: false } },
          { excuse: null },
        ],
      }).lean();

      sessions = [...neverStarted, ...startedLate];
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
