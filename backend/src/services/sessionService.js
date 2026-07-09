import Session from '../models/QueueSession.js';
import DoctorBranchSchedule from '../models/DoctorBranchSchedule.js';
import ScheduleException from '../models/ScheduleException.js';
import Appointment from '../models/Appointment.js';
import PatientProfile from '../models/PatientProfile.js';
import Account from '../models/Account.js';
import { AppError, NotFound } from '../utils/errors.js';
import { queueService } from './queueService.js';
import { wallClockNow } from '../utils/wallClockNow.js';

export const sessionService = {
  async generateSessions({ scheduleId, orgId, fromDate, toDate }) {
    const schedule = await DoctorBranchSchedule.findOne({
      _id: scheduleId,
      organization: orgId,
      status: 'active',
    });
    if (!schedule) throw NotFound('Schedule not found');

    const start = new Date(fromDate + 'T00:00:00Z');
    const end   = new Date(toDate   + 'T00:00:00Z');
    if (start > end) throw new AppError('fromDate must be before toDate', 400);

    const exceptions = await ScheduleException.find({
      doctorBranchSchedule: schedule._id,
      date: { $gte: start, $lte: end },
    });
    const exceptionDates = new Set(exceptions.map(e => e.date.toISOString().slice(0, 10)));

    let created = 0;
    let skipped = 0;
    const current = new Date(start);

    while (current <= end) {
      const dateStr  = current.toISOString().slice(0, 10);
      const dayOfWeek = current.getUTCDay();

      const slots = schedule.schedule.filter(s => s.dayOfWeek === dayOfWeek);

      if (slots.length === 0 || exceptionDates.has(dateStr)) {
        skipped += slots.length || 1;
        current.setUTCDate(current.getUTCDate() + 1);
        continue;
      }

      for (const slot of slots) {
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);

        const startTime = new Date(current);
        startTime.setUTCHours(sh, sm, 0, 0);
        const endTime = new Date(current);
        endTime.setUTCHours(eh, em, 0, 0);

        // Skip slots whose end time has already passed — creating them would
        // cause the auto-close cron to immediately cancel them. wallClockNow(),
        // not new Date() — startTime/endTime are local wall-clock digits (see
        // wallClockNow.js), so comparing against a genuine UTC instant would
        // be off by this server's UTC offset.
        if (endTime <= wallClockNow()) {
          skipped++;
          continue;
        }

        try {
          await Session.create({
            doctorBranchSchedule: schedule._id,
            branch:               schedule.branch,
            doctor:               schedule.doctorMembership,
            startTime,
            endTime,
            avgConsultationMin:   schedule.avgConsultationMin || 15,
            maxBookings:          schedule.defaultMaxBookings ?? null,
            consultationFee:      schedule.consultationFee?.amount ?? 0,
            currency:             schedule.consultationFee?.currency || 'EGP',
            status:               'scheduled',
            bookingsCount:        0,
            currentServing:       0,
          });
          created++;
        } catch (err) {
          if (err.code === 11000) { skipped++; }
          else throw err;
        }
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return { created, skipped };
  },

  async listSessions({ branchId, orgId, filters }) {
    const query = { branch: branchId };
    if (filters.status) query.status = String(filters.status);
    if (filters.date) {
      const d = new Date(filters.date + 'T00:00:00Z');
      query.startTime = { $gte: d, $lt: new Date(d.getTime() + 24 * 60 * 60 * 1000) };
    } else if (filters.fromDate && filters.toDate) {
      const d1 = new Date(filters.fromDate + 'T00:00:00Z');
      const d2 = new Date(filters.toDate + 'T00:00:00Z');
      query.startTime = { $gte: d1, $lt: new Date(d2.getTime() + 24 * 60 * 60 * 1000) };
    }
    return Session.find(query)
      .populate({ path: 'doctor', select: 'kind specialties', populate: { path: 'account', select: 'fullName' } })
      .sort({ startTime: 1 });
  },

  async getSession({ sessionId, branchId }) {
    const session = await Session.findOne({ _id: sessionId, branch: branchId });
    if (!session) throw NotFound('Session not found');
    return session;
  },

  async startSession({ session }) {
    if (session.status !== 'scheduled') {
      throw new AppError('Session is not in scheduled state', 409);
    }

    // A doctor can't run two live queues at once — if an earlier session
    // (e.g. one that stayed active past its endTime because patients were
    // still waiting) never got closed, force it closed now instead of
    // letting it run alongside this new one.
    const staleActive = await Session.find({
      doctor: session.doctor,
      _id:    { $ne: session._id },
      status: 'active',
    });
    for (const stale of staleActive) {
      await queueService.forceEndSession({ session: stale });
    }

    const now = new Date();
    session.actualStartTime = now;

    // Auto-detect late start: add overdue minutes to globalDelayMin so all
    // pending ETAs shift forward immediately for waiting patients.
    if (now > session.startTime) {
      const lateMin = Math.round((now.getTime() - session.startTime.getTime()) / 60_000);
      if (lateMin > 0) {
        session.lateStartMin   = lateMin;
        session.globalDelayMin = (session.globalDelayMin ?? 0) + lateMin;
      }
    }

    session.status = 'active';
    await session.save();
    await queueService.populateRedis({ session });
    // Notify waiting patients that the session has started
    await queueService.publishQueueUpdated(session._id);
    return session;
  },

  // Pushes the session's end time back instead of ending it — used when the
  // doctor still has patients waiting but the scheduled window is up. Also
  // keeps the session bookable for that much longer (marketplaceService
  // .getAvailableSessions and sessionAutoClose both key off endTime).
  async extendSession({ session, extraMinutes }) {
    if (session.status !== 'active') {
      throw new AppError('Session is not active', 409);
    }
    session.endTime = new Date(session.endTime.getTime() + extraMinutes * 60_000);
    await session.save();
    await queueService.publishQueueUpdated(session._id);
    return session;
  },

  async endSession({ session }) {
    if (session.status !== 'active') {
      throw new AppError('Session is not active', 409);
    }
    session.status = 'ended';
    session.actualEndTime = new Date();
    await session.save();

    // Mark all pending appointments as no_show with a closure note.
    await Appointment.updateMany(
      { session: session._id, status: { $in: ['booked', 'called', 'held', 'skipped', 'in_progress'] } },
      { $set: { status: 'no_show', sessionClosureNote: 'Session ended by clinic.' } },
    );

    // Notify all waiting patients via SSE that the session has ended.
    try {
      await queueService.publishSessionEnded(session._id);
    } catch { /* non-fatal */ }

    return session;
  },
};
