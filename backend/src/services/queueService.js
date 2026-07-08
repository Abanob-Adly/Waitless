import Appointment from '../models/Appointment.js';
import Session from '../models/QueueSession.js';
import Transaction from '../models/Transaction.js';
import Branch from '../models/Branch.js';
import { getActiveSubscription } from '../utils/subscription.js';
import { Membership } from '../models/Membership.js';
import DoctorBranchSchedule from '../models/DoctorBranchSchedule.js';
import { walletService } from './walletService.js';
import redis, { describeRedisError } from '../config/redis.js';
import { env } from '../config/env.js';
import { AppError, NotFound } from '../utils/errors.js';
import { generateToken } from '../utils/otp.js';

// Fixed durations (minutes) for short appointment types.
// 'new_consultation' falls back to the session's avgConsultationMin.
const APPT_DURATIONS_MIN = { follow_up: 5, medical_rep: 5 };

function apptDuration(appt, avgMin) {
  return APPT_DURATIONS_MIN[appt.appointmentType] ?? avgMin;
}

const VALID_TRANSITIONS = {
  booked:      ['called', 'cancelled', 'no_show'],
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
  } catch (err) { console.warn('[queue] Redis read failed:', describeRedisError(err)); }

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
  } catch (err) { console.warn('[queue] Redis publish failed:', describeRedisError(err)); }
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
      console.warn('[queue] Redis populate failed:', describeRedisError(err));
    }
  },

  async getQueueStatus({ sessionId }) {
    const state = await getQueueState(sessionId);
    if (!state) throw NotFound('Session not found');

    const [appointments, pendingConfirmation, session] = await Promise.all([
      Appointment.find({
        session: sessionId,
        status:  { $in: ['booked', 'called', 'held', 'skipped', 'in_progress'] },
      })
        .populate('patientProfile', 'fullName phone')
        .sort({ queueNumber: 1 })
        .lean(),
      // "Pay at clinic" bookings awaiting staff confirmation — not part of the
      // active queue yet, surfaced separately so staff can confirm or reject.
      Appointment.find({ session: sessionId, status: 'pending_confirmation' })
        .populate('patientProfile', 'fullName phone')
        .sort({ queueNumber: 1 })
        .lean(),
      Session.findById(sessionId).lean(),
    ]);

    const capacityInfo  = session ? queueService.checkDailyCapacity({ session }) : null;

    return {
      currentServing:     state.currentServing,
      avgConsultationMin: state.avgConsultationMin,
      globalDelayMin:     state.globalDelayMin,
      status:             state.status,
      totalWaiting:       appointments.length,
      appointments,
      pendingConfirmation,
      capacityInfo,
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
    } catch (err) { console.warn('[queue] Redis write failed:', describeRedisError(err)); }
    await publishUpdate(session._id, { type: 'updated', currentServing: next.queueNumber });

    return { appointment: next };
  },

  async holdPatient({ appointment, session }) {
    if (session.status !== 'active') {
      throw new AppError('Session is not active', 422);
    }
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
    if (session.status !== 'active') {
      throw new AppError('Session is not active', 422);
    }
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
    } catch (err) { console.warn('[queue] Redis write failed:', describeRedisError(err)); }
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
    } catch (err) { console.warn('[queue] Redis write failed:', describeRedisError(err)); }

    const state = await getQueueState(session._id);
    await publishUpdate(session._id, { type: 'delay_updated', ...state });

    return { ...session.toObject(), ...update };
  },

  async updateAppointmentStatus({ appointment, session, newStatus }) {
    if (session.status !== 'active') {
      throw new AppError('Session is not active', 422);
    }
    const allowed = VALID_TRANSITIONS[appointment.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new AppError(
        `Cannot transition appointment from '${appointment.status}' to '${newStatus}'`,
        422
      );
    }

    const wasCurrentlyServed = appointment.queueNumber === session.currentServing;

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
      // Clinic payments stay 'pending' until receptionist confirms cash received.
      if (appointment.paymentMethod !== 'clinic') {
        appointment.paymentStatus = 'success';
      }
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
      } catch (err) { console.warn('[queue] Redis write failed:', describeRedisError(err)); }
      await publishUpdate(session._id, {
        type: 'updated',
        currentServing: appointment.queueNumber,
      });
    }

    if (newStatus === 'completed') {
      // Auto-accumulate EWT delay from consultation overrun + adaptive average update
      if (appointment.consultationStartedAt) {
        const actualMin   = (now.getTime() - appointment.consultationStartedAt.getTime()) / 60_000;
        const expectedMin = apptDuration(appointment, session.avgConsultationMin);
        const overrunMin  = Math.max(0, actualMin - expectedMin);
        if (overrunMin > 0.5) { // ignore sub-30-second noise
          const rounded = Math.round(overrunMin * 10) / 10;
          await Session.findByIdAndUpdate(session._id, { $inc: { globalDelayMin: rounded } });
          try {
            const prev    = Number(await redis.hget(redisKey(session._id), 'globalDelayMin') || 0);
            const updated = Math.round((prev + rounded) * 10) / 10;
            await redis.hset(redisKey(session._id), 'globalDelayMin', String(updated));
          } catch (err) { console.warn('[queue] Redis write failed:', describeRedisError(err)); }
          await publishUpdate(session._id, { type: 'delay_updated', overrunMin: rounded });
        }

        // ── Feature B: Adaptive average (exponential smoothing, α=0.3) ────────
        // Only update for new_consultation types; follow_up / medical_rep have
        // fixed short durations that are not representative of the general pace.
        // Clamp actualMin to [1, 120] to discard absurd outliers (crash, browser close, etc.).
        if (!APPT_DURATIONS_MIN[appointment.appointmentType] && actualMin >= 1 && actualMin <= 120) {
          const ALPHA  = 0.3;
          const newAvg = Math.round((ALPHA * actualMin + (1 - ALPHA) * session.avgConsultationMin) * 10) / 10;

          await Session.findByIdAndUpdate(session._id, { avgConsultationMin: newAvg });
          session.avgConsultationMin = newAvg; // keep in-memory ref consistent
          try {
            await redis.hset(redisKey(session._id), 'avgConsultationMin', String(newAvg));
          } catch (err) { console.warn('[adaptive] Redis write failed:', describeRedisError(err)); }

          // Persist a slowly-drifting long-term average on the doctor's membership
          // (α=0.1) so future sessions start with a personalised baseline.
          Membership.findById(session.doctor).select('historicalAvgConsultationMin').lean()
            .then((mem) => {
              if (!mem) return;
              const oldHist = mem.historicalAvgConsultationMin ?? session.avgConsultationMin;
              const newHist = Math.round((0.1 * actualMin + 0.9 * oldHist) * 10) / 10;
              return Membership.findByIdAndUpdate(session.doctor, { historicalAvgConsultationMin: newHist });
            })
            .catch((e) => console.warn('[adaptive] Membership update failed:', e.message));
        }
      }

      // Persist financial split as a Transaction document
      try {
        const [scheduleDoc, sub, branchDoc, patientDoc] = await Promise.all([
          DoctorBranchSchedule.findById(session.doctorBranchSchedule).select('consultationFee').lean(),
          getActiveSubscription(appointment.organization),
          Branch.findById(appointment.branch).select('commissionPct').lean(),
          appointment.populate('patientProfile', 'fullName').then(() => appointment.patientProfile).catch(() => null),
        ]);

        const fee            = scheduleDoc?.consultationFee?.amount ?? 0;
        const platformPct    = sub?.plan?.platformCutPercent ?? 10;
        const commissionPct  = branchDoc?.commissionPct ?? 70;
        const platformCut    = Math.round(fee * platformPct / 100);
        const commissionAmt  = Math.round((fee - platformCut) * commissionPct / 100);
        const doctorNet      = fee - platformCut - commissionAmt;

        if (fee === 0) {
          console.warn('[PAYMENT] fee=0 for appointment', appointment._id, '— session.doctorBranchSchedule:', session.doctorBranchSchedule, 'scheduleDoc:', scheduleDoc);
        }

        await Transaction.create({
          org:              appointment.organization,
          branch:           appointment.branch,
          appointment:      appointment._id,
          doctorMembership: session.doctor,
          session:          session._id,
          patientName:      (typeof patientDoc === 'object' && patientDoc?.fullName) ? patientDoc.fullName : '',
          grossAmount:      fee,
          currency:         'EGP',
          platformCutPct:   platformPct,
          platformCut,
          commissionPct,
          commissionAmount: commissionAmt,
          doctorNet,
          status:           'settled',
        });

        // ── Wallet distribution (each op isolated so one failure doesn't block the others) ─
        if (fee > 0) {
          const apptId = appointment._id;
          const orgId  = appointment.organization;

          // Debit patient wallet — skip if already paid via wallet at booking time,
          // or if paying cash (receptionist collects physically).
          // card: charged externally via Paymob; wallet: prepaid at booking;
          // cash/clinic: physically collected — never debit the in-app patient wallet.
          if (!['wallet', 'cash', 'clinic', 'card'].includes(appointment.paymentMethod) && appointment.patientProfile) {
            try {
              const PatientProfile = (await import('../models/PatientProfile.js')).default;
              const pp = await PatientProfile.findById(appointment.patientProfile).select('accountId').lean();
              if (pp?.accountId) {
                await walletService.purchaseDebit({ accountId: pp.accountId, amount: fee, appointmentId: apptId });
              }
            } catch (e) {
              console.error('[WALLET] patient debit failed for appointment', apptId, ':', e.message);
            }
          }

          // Credit doctor wallet — independent of patient debit
          if (session.doctor && doctorNet > 0) {
            try {
              const mem = await Membership.findById(session.doctor).select('account').lean();
              if (mem?.account) {
                await walletService.doctorEarningCredit({ accountId: mem.account, amount: doctorNet, appointmentId: apptId });
              }
            } catch (e) {
              console.error('[WALLET] doctor credit failed for appointment', apptId, ':', e.message);
            }
          }

          // Credit org wallet — independent
          if (commissionAmt > 0) {
            try {
              await walletService.orgCommissionCredit({ orgId, amount: commissionAmt, appointmentId: apptId });
            } catch (e) {
              console.error('[WALLET] org credit failed for appointment', apptId, ':', e.message);
            }
          }
        }
      } catch (err) {
        console.error('[PAYMENT] transaction record failed for appointment', appointment._id, ':', err.message);
      }
    }

    // Broadcast queue change for statuses not already covered above.
    // 'called' publishes inline; 'completed' publishes via delay_updated.
    // no_show / cancelled / skipped shift EWTs for remaining patients — and if
    // the affected appointment was the one currently being served, advance the
    // queue to the next patient instead of leaving currentServing stuck.
    if (['no_show', 'cancelled', 'skipped'].includes(newStatus)) {
      if (wasCurrentlyServed) {
        const result = await queueService.callNext({ session });
        if (result?.done) {
          await publishUpdate(session._id, { type: 'updated' });
        }
      } else {
        await publishUpdate(session._id, { type: 'updated' });
      }
    }

    return appointment;
  },

  async forceInsert({ appointment, session, emergencyReason }) {
    if (session.status !== 'active') {
      throw new AppError('Session is not active', 422);
    }
    if (appointment.status !== 'booked') {
      throw new AppError('Only booked appointments can be force-inserted', 422);
    }
    if (appointment.queueNumber <= session.currentServing) {
      throw new AppError('Appointment is already in progress or past', 422);
    }

    const targetPosition = session.currentServing + 1;

    if (appointment.queueNumber !== targetPosition) {
      await Appointment.updateMany(
        {
          session:     session._id,
          queueNumber: { $gte: targetPosition, $lt: appointment.queueNumber },
          status:      { $in: ['booked', 'called', 'held', 'skipped'] },
        },
        { $inc: { queueNumber: 1 } },
      );
      appointment.queueNumber = targetPosition;
    }

    appointment.wasForceInserted = true;
    if (emergencyReason) appointment.emergencyReason = emergencyReason;
    await appointment.save();

    await publishUpdate(session._id, { type: 'updated' });
    return appointment;
  },

  async startBreak({ session, durationMin, reason }) {
    if (session.status !== 'active') {
      throw new AppError('Session is not active', 422);
    }
    if (session.isOnBreak) {
      throw new AppError('Session is already on break', 422);
    }

    const COOLDOWN_MIN = 30;
    const lastBreak = session.breaks?.[session.breaks.length - 1];
    if (lastBreak?.endedAt) {
      const elapsedMin = (Date.now() - new Date(lastBreak.endedAt).getTime()) / 60_000;
      if (elapsedMin < COOLDOWN_MIN) {
        const remainingMin = Math.ceil(COOLDOWN_MIN - elapsedMin);
        throw new AppError(
          `You must wait ${remainingMin} more minute${remainingMin !== 1 ? 's' : ''} before taking another break.`,
          422,
        );
      }
    }

    session.isOnBreak = true;
    if (!session.breaks) session.breaks = [];
    session.breaks.push({ startedAt: new Date(), reason: reason ?? null });

    // Add the planned break duration to the global delay so all waiting patients
    // immediately see their EWT shift forward.
    if (durationMin > 0) {
      session.globalDelayMin = (session.globalDelayMin ?? 0) + durationMin;
    }
    await session.save();

    try {
      await redis.hmset(redisKey(session._id), {
        globalDelayMin: String(session.globalDelayMin),
      });
    } catch (err) { console.warn('[queue] Redis write failed:', describeRedisError(err)); }

    await publishUpdate(session._id, {
      type:           'break_started',
      durationMin:    durationMin ?? 0,
      globalDelayMin: session.globalDelayMin,
    });
    return session;
  },

  async resumeFromBreak({ session }) {
    if (!session.isOnBreak) {
      throw new AppError('Session is not on break', 422);
    }

    const now = new Date();
    const lastBreak = session.breaks?.[session.breaks.length - 1];
    if (lastBreak && !lastBreak.endedAt) {
      lastBreak.endedAt     = now;
      lastBreak.durationMin = Math.round((now.getTime() - lastBreak.startedAt.getTime()) / 60_000);
    }

    session.isOnBreak = false;
    await session.save();

    await publishUpdate(session._id, { type: 'break_ended' });
    return session;
  },

  checkDailyCapacity({ session }) {
    const shiftMin   = (new Date(session.endTime) - new Date(session.startTime)) / 60_000;
    const maxPatients = Math.floor(shiftMin / session.avgConsultationMin);
    return {
      maxPatients,
      currentBookings: session.bookingsCount,
      remainingSlots:  Math.max(0, maxPatients - session.bookingsCount),
      isFull:          session.bookingsCount >= maxPatients,
    };
  },

  async trackByToken({ token }) {
    const appointment = await Appointment.findOne({ accessToken: token })
      .populate('session', 'currentServing avgConsultationMin globalDelayMin status isOnBreak doctor doctorBranchSchedule startTime')
      .populate('patientProfile', 'fullName')
      .lean();
    if (!appointment) throw NotFound('Appointment not found');

    const session = appointment.session;

    // Doctor/schedule lookups are independent of queue state — start them immediately
    // so they overlap with getQueueState + aheadAppointments instead of running after.
    const doctorScheduleP = Promise.all([
      Membership.findById(session.doctor).select('avatarUrl').populate('account', 'fullName').lean(),
      DoctorBranchSchedule.findById(session.doctorBranchSchedule).select('consultationFee').lean(),
    ]);

    // Redis-only lookup (not the shared getQueueState helper): that helper's
    // fallback re-fetches the session from Mongo on a cache miss, which is a
    // wasted round-trip here since `session` was already populated above —
    // falling back to it directly avoids a second DB query on every poll tick
    // whenever Redis is unavailable or cold.
    let cached = null;
    try {
      const raw = await redis.hgetall(redisKey(session._id));
      if (raw && raw.currentServing != null) {
        cached = {
          currentServing:     Number(raw.currentServing),
          avgConsultationMin: Number(raw.avgConsultationMin),
          globalDelayMin:     Number(raw.globalDelayMin || 0),
        };
      }
    } catch (err) { console.warn('[queue] Redis read failed:', describeRedisError(err)); }

    const currentServing     = cached?.currentServing     ?? session.currentServing;
    const avgConsultationMin = cached?.avgConsultationMin ?? session.avgConsultationMin;
    const globalDelayMin     = cached?.globalDelayMin     ?? session.globalDelayMin ?? 0;

    // Sum type-specific durations of all active appointments ahead in queue.
    // Cancelled / no-show appointments are excluded, giving accurate ETAs
    // after any gap-creating events.
    const [aheadAppointments, [doctorDoc, scheduleDoc]] = await Promise.all([
      Appointment.find({
        session:     session._id,
        queueNumber: { $gt: currentServing, $lt: appointment.queueNumber },
        status:      { $in: ['booked', 'called', 'held', 'in_progress'] },
      }).select('appointmentType').lean(),
      doctorScheduleP,
    ]);

    const estimatedWaitMin = aheadAppointments.reduce(
      (sum, a) => sum + apptDuration(a, avgConsultationMin),
      globalDelayMin,
    );

    return {
      queueNumber:        appointment.queueNumber,
      currentlyServing:   currentServing,
      // position = active patients still ahead of this patient (gaps from cancelled/no-show
      // appointments are excluded), so C correctly shows "2" even if B (queue #2) cancelled.
      position:           aheadAppointments.length + 1,
      estimatedWaitMin,
      globalDelayMin,
      avgConsultationMin,
      status:             appointment.status,
      sessionClosureNote: appointment.sessionClosureNote ?? null,
      reviewToken:        appointment.status === 'completed' ? (appointment.reviewToken ?? null) : null,
      patientName:        appointment.patientProfile.fullName,
      sessionDate:        session.startTime.toISOString().slice(0, 10),
      sessionStartTime:   session.startTime.toISOString(),
      sessionStatus:      session.status,
      isOnBreak:          session.isOnBreak ?? false,
      emergencyReason:    appointment.emergencyReason ?? null,
      wasForceInserted:   appointment.wasForceInserted ?? false,
      doctorName:         doctorDoc?.account?.fullName ?? '',
      doctorAvatarUrl:    doctorDoc?.avatarUrl ?? null,
      consultationFee:    scheduleDoc?.consultationFee?.amount ?? 0,
    };
  },

  async publishSessionEnded(sessionId) {
    await publishUpdate(sessionId, { type: 'session_ended' });
  },

  async publishQueueUpdated(sessionId) {
    await publishUpdate(sessionId, { type: 'updated' });
  },

  /**
   * Publish a typed cancellation event that carries the patient's name.
   * The doctor's dashboard SSE handler checks for type === 'cancellation' to show a toast.
   * All other clients (patients, receptionists) treat it like a generic 'updated' event
   * and simply re-fetch their status.
   */
  async publishCancellation(sessionId, patientName) {
    await publishUpdate(sessionId, { type: 'cancellation', patientName: patientName ?? '' });
  },
};
