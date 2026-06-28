import Appointment from '../models/Appointment.js';
import Session from '../models/QueueSession.js';
import { getActiveSubscription } from '../utils/subscription.js';
import { Membership } from '../models/Membership.js';
import DoctorBranchSchedule from '../models/DoctorBranchSchedule.js';
import redis from '../config/redis.js';
import { env } from '../config/env.js';
import { AppError, NotFound } from '../utils/errors.js';
import { generateToken } from '../utils/otp.js';

const VALID_TRANSITIONS = {
  booked:      ['called', 'cancelled'],
  called:      ['in_progress', 'skipped', 'no_show', 'cancelled', 'held'],
  held:        ['called', 'cancelled'],
  in_progress: ['completed', 'no_show'],
  skipped:     ['cancelled'],
};

const redisKey      = (id) => `queue:session:${id}`;
const redisPubChan  = (id) => `queue.session.${id}`;

async function getQueueState(sessionId) {
  try {
    const raw = await redis.hgetall(redisKey(sessionId));
    if (raw && raw.currentServing != null) {
      return {
        currentServing:     Number(raw.currentServing),
        avgConsultationMin: Number(raw.avgConsultationMin),
        globalDelayMin:     Number(raw.globalDelayMin || 0),
        status:             raw.status,
      };
    }
  } catch (err) { console.warn('[queue] Redis read failed:', err.message); }

  const session = await Session.findById(sessionId).lean();
  if (!session) return null;
  return {
    currentServing:     session.currentServing,
    avgConsultationMin: session.avgConsultationMin,
    globalDelayMin:     session.globalDelayMin || 0,
    status:             session.status,
  };
}

async function publishUpdate(sessionId, payload) {
  try {
    await redis.publish(redisPubChan(sessionId), JSON.stringify(payload));
  } catch (err) { console.warn('[queue] Redis publish failed:', err.message); }
}

export const queueService = {
  async populateRedis({ session }) {
    try {
      await redis.hmset(redisKey(session._id), {
        currentServing:     String(session.currentServing),
        avgConsultationMin: String(session.avgConsultationMin),
        globalDelayMin:     String(session.globalDelayMin || 0),
        status:             session.status,
      });
      await redis.expire(redisKey(session._id), 86400);
    } catch (err) {
      console.warn('[queue] Redis populate failed:', err.message);
    }
  },

  async getQueueStatus({ sessionId }) {
    const state = await getQueueState(sessionId);
    if (!state) throw NotFound('Session not found');

    const appointments = await Appointment.find({
      session: sessionId,
      status:  { $in: ['booked', 'called', 'held', 'skipped', 'in_progress'] },
    })
      .populate('patientProfile', 'fullName phone')
      .sort({ queueNumber: 1 });

    return {
      currentServing:     state.currentServing,
      avgConsultationMin: state.avgConsultationMin,
      globalDelayMin:     state.globalDelayMin,
      status:             state.status,
      totalWaiting:       appointments.length,
      appointments,
    };
  },

  async callNext({ session }) {
    const graceCutoff = new Date(Date.now() - env.queue.gracePeriodMin * 60 * 1000);

    // Auto-expire stale `called` appointments past grace period → skipped
    const stale = await Appointment.find({
      session:  session._id,
      status:   'called',
      calledAt: { $lt: graceCutoff },
    });
    for (const appt of stale) {
      appt.status    = 'skipped';
      appt.skippedAt = new Date();
      await appt.save();
    }

    // Oldest skipped first, then next booked by queue order
    let next = await Appointment.findOne({
      session: session._id,
      status:  'skipped',
    }).sort({ skippedAt: 1 });

    if (!next) {
      next = await Appointment.findOne({
        session: session._id,
        status:  'booked',
      }).sort({ queueNumber: 1 });
    }

    if (!next) return { done: true };

    next.status   = 'called';
    next.calledAt = new Date();
    await next.save();

    await Session.findByIdAndUpdate(session._id, { $set: { currentServing: next.queueNumber } });
    try {
      await redis.hset(redisKey(session._id), 'currentServing', String(next.queueNumber));
    } catch (err) { console.warn('[queue] Redis write failed:', err.message); }
    await publishUpdate(session._id, { type: 'updated', currentServing: next.queueNumber });

    return { appointment: next };
  },

  async holdPatient({ appointment, session }) {
    if (appointment.status !== 'called') {
      throw new AppError('Only a called appointment can be held', 422);
    }
    appointment.status = 'held';
    appointment.heldAt = new Date();
    await appointment.save();

    const nextResult = await queueService.callNext({ session });
    return { appointment, next: nextResult.appointment || null };
  },

  async reinsertPatient({ appointment, session }) {
    if (appointment.status !== 'held') {
      throw new AppError('Only a held appointment can be re-inserted', 422);
    }
    appointment.status   = 'called';
    appointment.calledAt = new Date();
    await appointment.save();

    await Session.findByIdAndUpdate(session._id, {
      $set: { currentServing: appointment.queueNumber },
    });
    try {
      await redis.hset(redisKey(session._id), 'currentServing', String(appointment.queueNumber));
    } catch (err) { console.warn('[queue] Redis write failed:', err.message); }
    await publishUpdate(session._id, {
      type: 'updated',
      currentServing: appointment.queueNumber,
    });

    return appointment;
  },

  async updateDelay({ session, data }) {
    const update = {};
    if (data.avgConsultationMin != null) update.avgConsultationMin = data.avgConsultationMin;
    if (data.globalDelayMin     != null) update.globalDelayMin     = data.globalDelayMin;

    await Session.findByIdAndUpdate(session._id, { $set: update });

    const patch = {};
    if (data.avgConsultationMin != null) patch.avgConsultationMin = String(data.avgConsultationMin);
    if (data.globalDelayMin     != null) patch.globalDelayMin     = String(data.globalDelayMin);
    try {
      await redis.hmset(redisKey(session._id), patch);
    } catch (err) { console.warn('[queue] Redis write failed:', err.message); }

    const state = await getQueueState(session._id);
    await publishUpdate(session._id, { type: 'delay_updated', ...state });

    return { ...session.toObject(), ...update };
  },

  async updateAppointmentStatus({ appointment, session, newStatus }) {
    const allowed = VALID_TRANSITIONS[appointment.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new AppError(
        `Cannot transition appointment from '${appointment.status}' to '${newStatus}'`,
        422
      );
    }

    const now = new Date();
    appointment.status = newStatus;
    if (newStatus === 'called')      appointment.calledAt              = now;
    if (newStatus === 'held')        appointment.heldAt                = now;
    if (newStatus === 'in_progress') {
      appointment.checkedInAt           = now;
      appointment.consultationStartedAt = now; // tracks actual start for EWT overrun calc
    }
    if (newStatus === 'completed') {
      appointment.completedAt = now;
      appointment.reviewToken = generateToken(24); // one-time review link token
    }
    if (newStatus === 'cancelled')   appointment.cancelledAt = now;
    if (newStatus === 'skipped')     appointment.skippedAt   = now;

    await appointment.save();

    // ── Post-save side-effects ────────────────────────────────────────────────

    if (newStatus === 'called') {
      await Session.findByIdAndUpdate(session._id, {
        $set: { currentServing: appointment.queueNumber },
      });
      try {
        await redis.hset(redisKey(session._id), 'currentServing', String(appointment.queueNumber));
      } catch (err) { console.warn('[queue] Redis write failed:', err.message); }
      await publishUpdate(session._id, {
        type: 'updated',
        currentServing: appointment.queueNumber,
      });
    }

    if (newStatus === 'completed') {
      // Auto-accumulate EWT delay from consultation overrun
      if (appointment.consultationStartedAt) {
        const actualMin  = (now.getTime() - appointment.consultationStartedAt.getTime()) / 60_000;
        const overrunMin = Math.max(0, actualMin - session.avgConsultationMin);
        if (overrunMin > 0.5) { // ignore sub-30-second noise
          const rounded = Math.round(overrunMin * 10) / 10;
          await Session.findByIdAndUpdate(session._id, { $inc: { globalDelayMin: rounded } });
          try {
            const prev    = Number(await redis.hget(redisKey(session._id), 'globalDelayMin') || 0);
            const updated = Math.round((prev + rounded) * 10) / 10;
            await redis.hset(redisKey(session._id), 'globalDelayMin', String(updated));
          } catch (err) { console.warn('[queue] Redis write failed:', err.message); }
          await publishUpdate(session._id, { type: 'delay_updated', overrunMin: rounded });
        }
      }

      // Mock financial split (replace with real payment ledger later)
      try {
        const [scheduleDoc, sub] = await Promise.all([
          DoctorBranchSchedule.findById(session.doctorBranchSchedule).select('consultationFee').lean(),
          getActiveSubscription(appointment.organization),
        ]);
        const fee         = scheduleDoc?.consultationFee?.amount ?? 0;
        const platformPct = sub?.plan?.platformCutPercent ?? 15;
        const platformCut = Math.round(fee * platformPct / 100);
        const orgCut      = Math.round((fee - platformCut) * 0.7);
        const doctorCut   = fee - platformCut - orgCut;
        console.log('[MOCK PAYMENT] Fee split for appointment', String(appointment._id), {
          consultationFee: fee, platformCut, orgCut, doctorCut, currency: 'EGP',
        });
      } catch (err) {
        console.warn('[MOCK PAYMENT] Split calculation failed:', err.message);
      }
    }

    return appointment;
  },

  async trackByToken({ token }) {
    const appointment = await Appointment.findOne({ accessToken: token })
      .populate('session')
      .populate('patientProfile', 'fullName');
    if (!appointment) throw NotFound('Appointment not found');

    const session = appointment.session;
    const state = await getQueueState(session._id);

    const currentServing     = state?.currentServing     ?? session.currentServing;
    const avgConsultationMin = state?.avgConsultationMin ?? session.avgConsultationMin;
    const globalDelayMin     = state?.globalDelayMin     ?? session.globalDelayMin ?? 0;

    const position         = Math.max(0, appointment.queueNumber - currentServing);
    const estimatedWaitMin = position * avgConsultationMin + globalDelayMin;

    const [doctorDoc, scheduleDoc] = await Promise.all([
      Membership.findById(session.doctor).populate('account', 'fullName').lean(),
      DoctorBranchSchedule.findById(session.doctorBranchSchedule).select('consultationFee').lean(),
    ]);

    return {
      queueNumber:      appointment.queueNumber,
      currentlyServing: currentServing,
      estimatedWaitMin,
      globalDelayMin,
      status:           appointment.status,
      patientName:      appointment.patientProfile.fullName,
      sessionDate:      session.startTime.toISOString().slice(0, 10),
      doctorName:       doctorDoc?.account?.fullName ?? '',
      consultationFee:  scheduleDoc?.consultationFee?.amount ?? 0,
    };
  },
};
