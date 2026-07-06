import Appointment from '../models/Appointment.js';
import Session from '../models/QueueSession.js';
import { patientService } from './patientService.js';
import { queueService } from './queueService.js';
import { walletService } from './walletService.js';
import { generateToken } from '../utils/otp.js';
import { AppError, Conflict, Forbidden, NotFound } from '../utils/errors.js';

const CANCELLATION_PENALTY_EGP = 50;
const CANCELLATION_GRACE_MS    = 60 * 60 * 1000; // 1 hour

const TERMINAL_STATUSES = ['completed', 'cancelled', 'no_show'];

export const appointmentService = {
  async bookWalkIn({ actor, sessionId, branchId, orgId, data }) {
    // Receptionist must be assigned to this branch
    if (actor.activeMembership?.kind === 'receptionist') {
      const assigned = (actor.activeMembership.branches || []).map(String);
      if (!assigned.includes(String(branchId))) {
        throw Forbidden('Receptionist is not authorized for this branch');
      }
    }

    const session = await Session.findOne({
      _id:    sessionId,
      branch: branchId,
      status: { $in: ['scheduled', 'active'] },
    }).populate('doctor');
    if (!session) throw NotFound('Session not found or not accepting bookings');

    // Enforce capacity if set
    if (session.maxBookings != null && session.bookingsCount >= session.maxBookings) {
      throw new AppError('Session is at full capacity', 409);
    }

    const profile = await patientService.findOrCreateWalkIn({
      orgId,
      branchId,
      phone:    data.patientPhone,
      fullName: data.patientName,
    });

    const updated = await Session.reserveQueueNumber(sessionId);
    if (!updated) throw new AppError('Session is no longer accepting bookings', 409);

    const queueNumber = updated.bookingsCount;
    const accessToken = generateToken(16);

    let appointment;
    try {
      appointment = await Appointment.create({
        session:          session._id,
        patientProfile:   profile._id,
        organization:     orgId,
        branch:           branchId,
        doctorMembership: session.doctor,
        queueNumber,
        status:           'booked',
        source:           'walk_in',
        bookedBy:         actor.activeMembership._id,
        accessToken,
        notes:            data.notes,
        appointmentType:  data.appointmentType ?? 'new_consultation',
      });
    } catch (err) {
      if (err.code === 11000) throw Conflict('Patient already has an active booking in this session');
      throw err;
    }

    // Simple positional EWT shown to receptionist at booking time
    const position        = Math.max(0, queueNumber - (updated.currentServing ?? 0));
    const estimatedWaitMin = position * (updated.avgConsultationMin ?? 15)
      + (updated.globalDelayMin ?? 0);

    return { appointment, accessToken, estimatedWaitMin };
  },

  async bookOverride({ actor, sessionId, branchId, orgId, data }) {
    if (actor.activeMembership?.kind !== 'admin') {
      throw Forbidden('Only admins can create override bookings');
    }

    const session = await Session.findOne({
      _id:    sessionId,
      branch: branchId,
      status: { $in: ['scheduled', 'active'] },
    }).populate('doctor');
    if (!session) throw NotFound('Session not found');

    const profile = await patientService.findOrCreateWalkIn({
      orgId,
      branchId,
      phone:    data.patientPhone,
      fullName: data.patientName,
    });

    // Override: use $inc regardless of maxBookings
    const updated = await Session.findOneAndUpdate(
      { _id: sessionId },
      { $inc: { bookingsCount: 1 } },
      { new: true }
    );
    if (!updated) throw NotFound('Session not found');

    const queueNumber = updated.bookingsCount;
    const accessToken = generateToken(16);

    let appointment;
    try {
      appointment = await Appointment.create({
        session:          session._id,
        patientProfile:   profile._id,
        organization:     orgId,
        branch:           branchId,
        doctorMembership: session.doctor,
        queueNumber,
        status:           'booked',
        source:           'override',
        bookedBy:         actor.activeMembership._id,
        accessToken,
        notes:            data.notes,
      });
    } catch (err) {
      if (err.code === 11000) throw Conflict('Patient already has an active booking in this session');
      throw err;
    }

    return { appointment, accessToken };
  },

  async listAppointments({ sessionId, filters }) {
    const query = { session: sessionId };
    if (filters.status) query.status = filters.status;
    return Appointment.find(query)
      .populate('patientProfile', 'fullName phone')
      .sort({ queueNumber: 1 });
  },

  async getAppointment({ appointment }) {
    return Appointment.findById(appointment._id).populate('patientProfile', 'fullName phone');
  },

  async cancelAppointment({ appointment, reason, patientAccountId }) {
    if (TERMINAL_STATUSES.includes(appointment.status)) {
      throw new AppError('Cannot cancel a closed appointment', 409);
    }

    // Cancellation penalty: 50 EGP if patient cancels within 1 hour of session start.
    // Only applies to patient self-cancellations (patientAccountId supplied).
    // Staff cancellations (patientAccountId = null) are penalty-free.
    let penaltyApplied = false;
    if (patientAccountId) {
      const session = await Session.findById(appointment.session).select('startTime').lean();
      if (session) {
        const msTillStart = new Date(session.startTime).getTime() - Date.now();
        if (msTillStart < CANCELLATION_GRACE_MS && msTillStart > -CANCELLATION_GRACE_MS) {
          // Within the 1-hour window — apply penalty regardless of balance (allows negative)
          await walletService.cancellationPenalty({
            accountId:     patientAccountId,
            amount:        CANCELLATION_PENALTY_EGP,
            appointmentId: appointment._id,
          });
          penaltyApplied = true;
        }
      }
    }

    appointment.status          = 'cancelled';
    appointment.cancelledAt     = new Date();
    appointment.cancelledReason = reason || null;
    await appointment.save();

    // Publish queue update so live-tracking clients recalculate positions
    try {
      await queueService.publishQueueUpdated(appointment.session);
    } catch {
      // Non-fatal: Redis unavailable
    }

    return { appointment, penaltyApplied };
  },

  async getOwnAppointments({ actor }) {
    const PatientProfile = (await import('../models/PatientProfile.js')).default;
    const profile = await PatientProfile.findOne({ accountId: actor.account._id });
    if (!profile) return [];

    return Appointment.find({ patientProfile: profile._id })
      .populate({
        path: 'doctorMembership',
        select: 'specialties account',
        populate: { path: 'account', select: 'fullName' },
      })
      .populate({
        path: 'session',
        select: 'startTime endTime status',
      })
      .populate('branch', 'name')
      .sort({ createdAt: -1 })
      .limit(50);
  },
};
