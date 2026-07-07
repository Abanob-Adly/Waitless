import { z } from 'zod';
import { queueService } from '../services/queueService.js';
import Session from '../models/QueueSession.js';
import Appointment from '../models/Appointment.js';
import DoctorBranchSchedule from '../models/DoctorBranchSchedule.js';
import { NotFound } from '../utils/errors.js';
import redis from '../config/redis.js';

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

  startBreak: z.object({
    durationMin: z.number().int().min(1).max(120),
    reason:      z.string().max(200).optional(),
  }),

  forceInsert: z.object({
    emergencyReason: z.string().max(300).optional(),
  }),
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

  async forceInsert(req, res) {
    const appointment = await Appointment.findOne({
      _id:     req.params.appointmentId,
      session: req.params.sessionId,
    });
    if (!appointment) throw NotFound('Appointment not found');

    const session = await Session.findById(req.params.sessionId);
    if (!session) throw NotFound('Session not found');

    const result = await queueService.forceInsert({
      appointment,
      session,
      emergencyReason: req.body?.emergencyReason,
    });
    res.json({ data: result });
  },

  async startBreak(req, res) {
    const session = await Session.findOne({ _id: req.params.sessionId, branch: req.params.branchId });
    if (!session) throw NotFound('Session not found');
    const result = await queueService.startBreak({
      session,
      durationMin: req.body.durationMin,
      reason:      req.body.reason,
    });
    res.json({ data: result });
  },

  async resumeFromBreak(req, res) {
    const session = await Session.findOne({ _id: req.params.sessionId, branch: req.params.branchId });
    if (!session) throw NotFound('Session not found');
    const result = await queueService.resumeFromBreak({ session });
    res.json({ data: result });
  },

  // SSE endpoint: streams queue updates to authenticated staff
  async subscribe(req, res) {
    const { sessionId } = req.params;
    res.writeHead(200, {
      'Content-Type':    'text/event-stream',
      'Cache-Control':   'no-cache',
      'Connection':      'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');

    const channel = `queue.session.${sessionId}`;
    const sub = redis.duplicate();
    // A duplicated client does not inherit the parent's 'error' listener — an
    // EventEmitter with no 'error' listener throws and crashes the whole
    // process on connection failure (e.g. Redis down). Must attach this
    // before any command is issued on `sub`.
    sub.on('error', (err) => console.warn('[queue] SSE subscriber error:', err.message));

    try {
      await sub.subscribe(channel);
    } catch (err) {
      console.warn('[queue] SSE subscribe failed:', err.message);
      res.end();
      return;
    }

    sub.on('message', (_ch, message) => {
      res.write(`data: ${message}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sub.unsubscribe().catch(() => {});
      sub.quit().catch(() => {});
    });
  },

  async cashSummary(req, res) {
    const session = await Session.findById(req.params.sessionId)
      .populate({ path: 'doctorBranchSchedule', select: 'consultationFee' })
      .lean();
    if (!session) throw NotFound('Session not found');

    const fee = session.doctorBranchSchedule?.consultationFee?.amount ?? 0;

    // Include walk-in cash AND clinic appointments confirmed as paid
    const appointments = await Appointment.find({
      session: req.params.sessionId,
      status:  'completed',
      $or: [
        { paymentMethod: 'cash' },
        { paymentMethod: 'clinic', paymentStatus: 'success' },
      ],
    }).populate('patientProfile', 'fullName').lean();

    const totalCash = appointments.reduce((sum, a) => sum + (a.paidAmount ?? fee), 0);

    res.json({
      data: {
        totalCash,
        count:             appointments.length,
        feePerAppointment: fee,
        appointments:      appointments.map((a) => ({
          queueNumber:   a.queueNumber,
          patientName:   a.patientProfile?.fullName ?? '',
          completedAt:   a.completedAt,
          paymentMethod: a.paymentMethod,
          paidAmount:    a.paidAmount ?? fee,
          paidAt:        a.paidAt,
        })),
      },
    });
  },
};
