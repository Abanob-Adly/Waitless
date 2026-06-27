import Appointment from '../models/Appointment.js';
import Session from '../models/QueueSession.js';
import { patientService } from './patientService.js';
import { generateToken } from '../utils/otp.js';
import { AppError, Conflict, Forbidden, NotFound } from '../utils/errors.js';

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
      });
    } catch (err) {
      if (err.code === 11000) throw Conflict('Patient already has an active booking in this session');
      throw err;
    }

    return { appointment, accessToken };
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

  async cancelAppointment({ appointment, reason }) {
    if (TERMINAL_STATUSES.includes(appointment.status)) {
      throw new AppError('Cannot cancel a closed appointment', 409);
    }
    appointment.status          = 'cancelled';
    appointment.cancelledAt     = new Date();
    appointment.cancelledReason = reason || null;
    await appointment.save();
    return appointment;
  },
};
