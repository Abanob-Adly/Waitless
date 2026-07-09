import Appointment from '../models/Appointment.js';
import Session from '../models/QueueSession.js';
import { patientService } from './patientService.js';
import { queueService } from './queueService.js';
import { generateToken } from '../utils/otp.js';
import { AppError, Conflict, Forbidden, NotFound } from '../utils/errors.js';

const TERMINAL_STATUSES = ['completed', 'cancelled', 'no_show'];

export const appointmentService = {
  async bookWalkIn({ actor, sessionId, branchId, orgId, data }) {
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
    if (filters.status) query.status = String(filters.status);
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

    const session = await Session.findById(appointment.session);
    if (!session) throw NotFound('Session not found');

    const wasCurrentlyServed = appointment.queueNumber === session.currentServing;

    appointment.status          = 'cancelled';
    appointment.cancelledAt     = new Date();
    appointment.cancelledReason = reason || null;
    await appointment.save();

    let patientName = '';
    try {
      const PatientProfile = (await import('../models/PatientProfile.js')).default;
      const profileId = appointment.patientProfile?._id ?? appointment.patientProfile;
      const pp = await PatientProfile.findById(profileId).select('fullName').lean();
      patientName = pp?.fullName ?? '';
    } catch { /* ignore */ }

    try {
      await queueService.publishCancellation(appointment.session, patientName);
    } catch { /* Non-fatal: Redis unavailable */ }

    if (wasCurrentlyServed) {
      const result = await queueService.callNext({ session });
      if (result?.done) {
        await queueService.publishQueueUpdated(session._id);
      }
    }

    return { appointment };
  },

  async getOwnAppointments({ actor }) {
    const PatientProfile = (await import('../models/PatientProfile.js')).default;
    const Review = (await import('../models/Review.js')).default;
    const profile = await PatientProfile.findOne({ accountId: actor.account._id });
    if (!profile) return [];

    const appointments = await Appointment.find({ patientProfile: profile._id })
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
      .limit(50)
      .lean();

    // Completed appointments keep their reviewToken forever, so the client
    // needs to know which ones are already reviewed — otherwise a patient
    // who already left a review keeps getting re-prompted for it.
    const reviewableIds = appointments
      .filter((a) => a.status === 'completed' && a.reviewToken)
      .map((a) => a._id);
    const reviewedIds = new Set(
      (await Review.find({ appointment: { $in: reviewableIds } }).select('appointment').lean())
        .map((r) => String(r.appointment)),
    );

    return appointments.map((a) => ({ ...a, hasReview: reviewedIds.has(String(a._id)) }));
  },
};
