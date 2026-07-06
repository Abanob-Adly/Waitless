import cron from 'node-cron';
import DoctorBranchSchedule from '../models/DoctorBranchSchedule.js';
import { sessionService } from '../services/sessionService.js';

export function startSessionGeneratorCron() {
  // Runs daily at 01:00 UTC — generates sessions for the next 15 days rolling window
  cron.schedule('0 1 * * *', async () => {
    try {
      const schedules = await DoctorBranchSchedule.find({ status: 'active' }).lean();
      const tomorrow  = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const horizon   = new Date();
      horizon.setUTCDate(horizon.getUTCDate() + 15);
      const fromDate  = tomorrow.toISOString().slice(0, 10);
      const toDate    = horizon.toISOString().slice(0, 10);

      for (const s of schedules) {
        try {
          await sessionService.generateSessions({
            scheduleId: String(s._id),
            orgId:      String(s.organization),
            fromDate,
            toDate,
          });
        } catch (err) {
          console.error(`[cron] generateSessions failed for schedule ${s._id}:`, err.message);
        }
      }
      console.log(`[cron] sessionGenerator: processed ${schedules.length} schedules for ${fromDate} → ${toDate}`);
    } catch (err) {
      console.error('[cron] sessionGenerator fatal error:', err.message);
    }
  });
}
