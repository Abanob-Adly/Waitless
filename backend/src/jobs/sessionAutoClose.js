import cron from 'node-cron';
import Session from '../models/QueueSession.js';
import Appointment from '../models/Appointment.js';
import { queueService } from '../services/queueService.js';
import { wallClockNow } from '../utils/wallClockNow.js';

/**
 * Runs every minute.
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
// Small buffer before auto-ending an active session past its endTime — just
// enough to absorb cron-tick timing, not a window for the doctor to linger.
// Sessions should close automatically at their scheduled end, not ~20 minutes
// after it (the old 10-minute grace + 10-minute cron interval).
const ACTIVE_GRACE_MS = 60_000; // 1 minute
// Extra buffer before cancelling a session that was never started.
const CANCEL_GRACE_MS = 15 * 60_000; // 15 minutes

export function startSessionAutoCloseCron() {
  cron.schedule('* * * * *', async () => {
    // wallClockNow(), not new Date() — startTime/endTime are stored as local
    // wall-clock digits (see wallClockNow.js), so comparing against a genuine
    // UTC instant would close sessions this server's UTC-offset worth of
    // hours off from the time staff actually scheduled.
    const now = wallClockNow();
    // Active sessions: only auto-close after 10-min grace past endTime so the
    // doctor has a window to end the session manually after the scheduled shift.
    // Scheduled sessions: cancel after the 15-min grace (doctor may still start).
    const activeDeadline    = new Date(now.getTime() - ACTIVE_GRACE_MS);
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

        await Session.findByIdAndUpdate(session._id, { $set: { status: 'ended', actualEndTime: new Date() } });

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
