import { z } from 'zod';
import { appointmentService } from '../services/appointmentService.js';
import { queueService } from '../services/queueService.js';

export const appointmentSchemas = {
  bookWalkIn: z.object({
    patientPhone:    z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'),
    patientName:     z.string().min(2).max(100),
    notes:           z.string().max(500).optional(),
    appointmentType: z.enum(['new_consultation', 'follow_up', 'medical_rep']).optional(),
  }),

  bookOverride: z.object({
    patientPhone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'),
    patientName:  z.string().min(2).max(100),
    notes:        z.string().max(500).optional(),
  }),

  cancel: z.object({
    reason: z.string().max(200).optional(),
  }),
};

export const appointmentController = {
  async book(req, res) {
    const { appointment, accessToken } = await appointmentService.bookWalkIn({
      actor:     req.actor,
      sessionId: req.params.sessionId,
      branchId:  req.params.branchId,
      orgId:     req.params.orgId,
      data:      req.body,
    });
    res.status(201).json({ data: { appointment, accessToken } });
  },

  async bookOverride(req, res) {
    const { appointment, accessToken } = await appointmentService.bookOverride({
      actor:     req.actor,
      sessionId: req.params.sessionId,
      branchId:  req.params.branchId,
      orgId:     req.params.orgId,
      data:      req.body,
    });
    res.status(201).json({ data: { appointment, accessToken } });
  },

  async list(req, res) {
    const appointments = await appointmentService.listAppointments({
      sessionId: req.params.sessionId,
      filters:   req.query,
    });
    res.json({ data: appointments });
  },

  async get(req, res) {
    const appointment = await appointmentService.getAppointment({ appointment: req.resource });
    res.json({ data: appointment });
  },

  async cancel(req, res) {
    // Pass the patient's account ID only if the actor is the patient themselves.
    // Staff cancellations (receptionist/admin) are penalty-free.
    const patientAccountId =
      req.actor?.account?.role === 'patient' ? String(req.actor.account._id) : null;

    const { appointment, penaltyApplied } = await appointmentService.cancelAppointment({
      appointment:       req.resource,
      reason:            req.body.reason,
      patientAccountId,
    });
    res.json({ data: appointment, penaltyApplied });
  },

  async track(req, res) {
    const result = await queueService.trackByToken({ token: req.params.token });
    res.json({ data: result });
  },

  async getOwn(req, res) {
    const result = await appointmentService.getOwnAppointments({ actor: req.actor });
    res.json({ data: result });
  },

  // Patient self-cancel: verifies the appointment belongs to the authenticated patient.
  async selfCancel(req, res) {
    const PatientProfile = (await import('../models/PatientProfile.js')).default;
    const Appointment    = (await import('../models/Appointment.js')).default;
    const { AppError }   = await import('../utils/errors.js');

    const profile = await PatientProfile.findOne({ accountId: req.actor.account._id });
    if (!profile) throw new AppError('Patient profile not found', 404);

    const appointment = await Appointment.findOne({
      _id:            req.params.appointmentId,
      patientProfile: profile._id,
    });
    if (!appointment) throw new AppError('Appointment not found', 404);

    const { appointment: updated, penaltyApplied } = await appointmentService.cancelAppointment({
      appointment,
      reason:           'Patient self-cancelled',
      patientAccountId: String(req.actor.account._id),
    });
    res.json({ data: updated, penaltyApplied });
  },
};
