import cron from 'node-cron';
import Session from '../models/QueueSession.js';
import { sessionService } from '../services/sessionService.js';

/**
 * Runs every minute.
 *
 * Finds sessions that are still 'scheduled' but whose startTime has passed
 * (and whose endTime hasn't), and starts them automatically — mirroring what
 * a doctor manually clicking "Start Now" would do.
 *
 * Sessions whose endTime has already passed are left alone: sessionAutoClose.js
 * handles those as a doctor no-show (cancelled), rather than force-activating
 * a session that's effectively already over.
 */
export function startSessionAutoStartCron() {
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    let sessions;
    try {
      sessions = await Session.find({
        status:    'scheduled',
        startTime: { $lte: now },
        endTime:   { $gt: now },
      });
    } catch (err) {
      console.error('[sessionAutoStart] DB query failed:', err.message);
      return;
    }

    for (const session of sessions) {
      try {
        await sessionService.startSession({ session });
        console.log(`[sessionAutoStart] Auto-started session ${session._id}`);
      } catch (err) {
        // Race: doctor may have manually started it between find() and now.
        console.warn(`[sessionAutoStart] Failed for session ${session._id}:`, err.message);
      }
    }
  });
}
