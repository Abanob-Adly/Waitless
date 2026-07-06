import cron from 'node-cron';
import Session from '../models/QueueSession.js';
import Appointment from '../models/Appointment.js';
import { queueService } from '../services/queueService.js';

/**
 * Runs every 10 minutes.
 *
 * Finds sessions whose end window has passed and auto-closes them:
 *  - status 'scheduled' (never started): → 'cancelled'  (doctor no-show)
 *  - status 'active'   (started, not ended): → 'ended'  (shift over)
 *
 * For 'active' sessions: any appointment still in an open state is set to
 * 'no_show'. A Redis pub/sub update is published so live-tracking clients
 * disconnect cleanly.
 *
 * Idempotent: the status filter guarantees each session is processed once.
 */
// Extra buffer before cancelling a session that was never started.
// Gives the doctor a window past the scheduled end time to press Start if they're running late.
const CANCEL_GRACE_MS = 15 * 60_000; // 15 minutes

export function startSessionAutoCloseCron() {
  cron.schedule('*/10 * * * *', async () => {
    const now = new Date();
    // Active sessions: close as soon as endTime passes (shift is over).
    // Scheduled sessions: only cancel after the grace period (doctor may still start).
    const activeDeadline    = now;
    const scheduledDeadline = new Date(now.getTime() - CANCEL_GRACE_MS);

    let sessions;
    try {
      sessions = await Session.find({
        $or: [
          { status: 'active',    endTime: { $lt: activeDeadline } },
          { status: 'scheduled', endTime: { $lt: scheduledDeadline } },
        ],
      }).lean();
    } catch (err) {
      console.error('[sessionAutoClose] DB query failed:', err.message);
      return;
    }

    for (const session of sessions) {
      try {
        if (session.status === 'scheduled') {
          // Never started — mark cancelled
          await Session.findByIdAndUpdate(session._id, { $set: { status: 'cancelled' } });
          console.log(`[sessionAutoClose] Cancelled scheduled session ${session._id}`);
          continue;
        }

        // status === 'active' — close open appointments first
        const openStatuses = ['booked', 'called', 'held', 'skipped', 'in_progress'];
        const result = await Appointment.updateMany(
          { session: session._id, status: { $in: openStatuses } },
          { $set: { status: 'no_show' } },
        );

        await Session.findByIdAndUpdate(session._id, { $set: { status: 'ended' } });

        // Notify live-tracking clients
        try {
          await queueService.publishSessionEnded(session._id);
        } catch {
          // Redis unavailable — clients will detect via next poll
        }

        console.log(
          `[sessionAutoClose] Ended session ${session._id}, ` +
          `marked ${result.modifiedCount} appointments no_show`,
        );
      } catch (err) {
        console.warn(`[sessionAutoClose] Failed for session ${session._id}:`, err.message);
      }
    }
  });
}
