import { z } from 'zod';
import { queueService } from '../services/queueService.js';
import Session from '../models/QueueSession.js';
import Appointment from '../models/Appointment.js';
import { NotFound } from '../utils/errors.js';

export const queueSchemas = {
  updateStatus: z.object({
    status: z.enum(['in_progress', 'completed', 'no_show', 'skipped', 'called', 'held', 'cancelled']),
  }),

  updateDelay: z.object({
    avgConsultationMin: z.number().int().min(1).max(120).optional(),
    globalDelayMin:     z.number().int().min(0).max(180).optional(),
  }).refine(
    (d) => d.avgConsultationMin != null || d.globalDelayMin != null,
    { message: 'At least one of avgConsultationMin or globalDelayMin is required' }
  ),
};

export const queueController = {
  async getStatus(req, res) {
    const result = await queueService.getQueueStatus({ sessionId: req.params.sessionId });
    res.json({ data: result });
  },

  async callNext(req, res) {
    const session = await Session.findOne({ _id: req.params.sessionId, status: 'active' });
    if (!session) throw NotFound('Active session not found');
    const result = await queueService.callNext({ session });
    res.json({ data: result });
  },

  async updateStatus(req, res) {
    const appointment = await Appointment.findOne({
      _id:     req.params.appointmentId,
      session: req.params.sessionId,
    });
    if (!appointment) throw NotFound('Appointment not found');

    const session = await Session.findById(req.params.sessionId);
    const updated = await queueService.updateAppointmentStatus({
      appointment,
      session,
      newStatus: req.body.status,
    });
    res.json({ data: updated });
  },

  async hold(req, res) {
    const appointment = await Appointment.findOne({
      _id:     req.params.appointmentId,
      session: req.params.sessionId,
    });
    if (!appointment) throw NotFound('Appointment not found');

    const session = await Session.findById(req.params.sessionId);
    const result = await queueService.holdPatient({ appointment, session });
    res.json({ data: result });
  },

  async reinsert(req, res) {
    const appointment = await Appointment.findOne({
      _id:     req.params.appointmentId,
      session: req.params.sessionId,
    });
    if (!appointment) throw NotFound('Appointment not found');

    const session = await Session.findById(req.params.sessionId);
    const updated = await queueService.reinsertPatient({ appointment, session });
    res.json({ data: updated });
  },

  async updateDelay(req, res) {
    const session = await Session.findById(req.params.sessionId);
    if (!session) throw NotFound('Session not found');

    const result = await queueService.updateDelay({ session, data: req.body });
    res.json({ data: result });
  },
};
