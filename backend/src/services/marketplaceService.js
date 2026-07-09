import Organization from '../models/Organization.js';
import Branch from '../models/Branch.js';
import { Membership, DoctorMembership } from '../models/Membership.js';
import Session from '../models/QueueSession.js';
import DoctorBranchSchedule from '../models/DoctorBranchSchedule.js';
import PatientProfile from '../models/PatientProfile.js';
import Appointment from '../models/Appointment.js';
import { generateToken } from '../utils/otp.js';
import { AppError, Conflict, NotFound } from '../utils/errors.js';
import { wallClockNow } from '../utils/wallClockNow.js';


export const marketplaceService = {
  async searchOrgs({ query, type, city, page = 1, limit = 20 }) {
    const filter = { isPublic: true, status: 'active' };
    if (type)  filter.type = type;

    const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const parsedPage  = Math.max(1, Number(page) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    let orgs;
    if (query) {
      orgs = await Organization.find({ ...filter, $text: { $search: query } })
        .skip(skip)
        .limit(parsedLimit);
    } else {
      orgs = await Organization.find(filter).skip(skip).limit(parsedLimit).sort({ name: 1 });
    }

    return orgs;
  },

  async getPublicDoctors({ orgId }) {
    const doctors = await DoctorMembership.find({
      organization: orgId,
      status: 'active',
    })
      .populate('account', 'fullName avatarUrl')
      .select('specialties bio services ratingStats account languagesSpoken acceptedInsurances yearsOfExperience avatarUrl');

    // Attach consultation fee from the doctor's active schedule
    const schedules = await DoctorBranchSchedule.find({
      doctorMembership: { $in: doctors.map(d => d._id) },
      organization: orgId,
      status: 'active',
    }).select('doctorMembership consultationFee');

    const feeMap = {};
    schedules.forEach(s => {
      feeMap[s.doctorMembership.toString()] = s.consultationFee?.amount ?? 0;
    });

    return doctors
      .map(d => ({ ...d.toObject(), consultationFee: feeMap[d._id.toString()] ?? 0 }))
      .filter(d => d.consultationFee > 0);
  },

  async getAvailableSessions({ orgId, doctorId, date }) {
    const query = {
      status: { $in: ['scheduled', 'active'] },
    };

    if (doctorId) query.doctor = doctorId;

    if (date) {
      const d = new Date(date + 'T00:00:00Z');
      query.startTime = { $gte: d, $lt: new Date(d.getTime() + 24 * 60 * 60 * 1000) };
    } else {
      // Bookable as long as the session hasn't ended yet — NOT gated on
      // startTime, so an already-started 'active' session with open slots
      // stays bookable instead of disappearing the moment it begins.
      query.endTime = { $gte: wallClockNow() };
    }

    const sessions = await Session.find(query)
      .populate('branch', 'name address')
      .populate('doctor', 'specialties ratingStats')
      .populate('doctorBranchSchedule', 'consultationFee')
      .sort({ startTime: 1 })
      .limit(50);

    // Filter sessions to only include org's branches
    const orgBranches = await Branch.find({ organization: orgId, isActive: true }).distinct('_id');
    const orgBranchSet = new Set(orgBranches.map(id => id.toString()));

    return sessions.filter(s => orgBranchSet.has(s.branch._id.toString()));
  },

  async getPublicReviews({ doctorMembershipId, limit = 10 }) {
    const Review = (await import('../models/Review.js')).default;
    const reviews = await Review.find({ doctorMembership: doctorMembershipId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({
        path: 'appointment',
        select: 'patientProfile',
        populate: { path: 'patientProfile', select: 'fullName' },
      })
      .select('rating comment createdAt');
    return reviews;
  },

  async bookMarketplace({ actor, sessionId, paymentMethod, notes }) {
    const session = await Session.findOne({
      _id:    sessionId,
      status: { $in: ['scheduled', 'active'] },
    });
    if (!session) throw NotFound('Session not found or not accepting bookings');

    if (!actor.account.phone) {
      throw new AppError('Phone number required to book. Please update your profile.', 422);
    }

    let profile = await PatientProfile.findOne({ accountId: actor.account._id });
    if (!profile) {
      profile = await PatientProfile.create({
        accountId: actor.account._id,
        fullName:  actor.account.fullName,
        phone:     actor.account.phone,
      });
    }

    // Resume an existing unpaid booking instead of creating a duplicate and
    // burning another queue slot — this happens when a patient cancels/returns
    // from the Paymob checkout page and retries payment for the same session.
    const existing = await Appointment.findOne({
      session:        sessionId,
      patientProfile: profile._id,
      status:         { $in: ['pending_confirmation', 'booked', 'called', 'held', 'skipped', 'in_progress'] },
    });
    if (existing) {
      if (existing.paymentStatus === 'success') {
        throw Conflict('You already have an active booking in this session');
      }
      return { appointment: existing, accessToken: existing.accessToken };
    }

    // "Pay at clinic" bookings join the real queue immediately as 'booked' —
    // paymentStatus stays 'pending' (the model default) until a receptionist
    // or doctor confirms the cash payment (appointmentController.confirmPayment),
    // which only flips payment fields, not queue membership.
    const isPayAtClinic = paymentMethod === 'clinic';

    // Cap concurrent unpaid pay-at-clinic bookings per patient — without this,
    // a patient could hold unlimited unpaid slots across many sessions with no
    // commitment, occupying receptionist/doctor queue slots that a paying
    // patient could have used instead. Online (paymob) bookings pay immediately
    // and are unaffected. Scoped across all sessions, not just this one — the
    // `existing` check above already prevents duplicates within one session.
    if (isPayAtClinic) {
      const unpaidClinicCount = await Appointment.countDocuments({
        patientProfile: profile._id,
        paymentMethod:  'clinic',
        paymentStatus:  { $ne: 'success' },
        status:         { $in: ['pending_confirmation', 'booked', 'called', 'held', 'skipped', 'in_progress'] },
      });
      if (unpaidClinicCount >= 2) {
        throw new AppError(
          'You have 2 unpaid pay-at-clinic bookings already. Please pay at the clinic or cancel one before booking another this way.',
          422,
        );
      }
    }

    const updated = await Session.reserveQueueNumber(sessionId);
    if (!updated) throw new AppError('Session is no longer accepting bookings', 409);

    const queueNumber = updated.bookingsCount;
    const accessToken = generateToken(16);

    let appointment;
    try {
      appointment = await Appointment.create({
        session:          session._id,
        patientProfile:   profile._id,
        organization:     (await Branch.findById(session.branch)).organization,
        branch:           session.branch,
        doctorMembership: session.doctor,
        queueNumber,
        status:           'booked',
        source:           'marketplace',
        paymentMethod:    paymentMethod ?? null,
        notes:            notes || undefined,
        accessToken,
      });
    } catch (err) {
      if (err.code === 11000) throw Conflict('You already have an active booking in this session');
      throw err;
    }

    return { appointment, accessToken };
  },
};
