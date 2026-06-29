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
    const appointment = await appointmentService.cancelAppointment({
      appointment: req.resource,
      reason:      req.body.reason,
    });
    res.json({ data: appointment });
  },

  async track(req, res) {
    const result = await queueService.trackByToken({ token: req.params.token });
    res.json({ data: result });
  },

  async getOwn(req, res) {
    const result = await appointmentService.getOwnAppointments({ actor: req.actor });
    res.json({ data: result });
  },
};
