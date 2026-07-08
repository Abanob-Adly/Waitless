import { z } from 'zod';
import { appointmentService } from '../services/appointmentService.js';
import { queueService } from '../services/queueService.js';
import redis, { describeRedisError } from '../config/redis.js';

export const appointmentSchemas = {
  confirmPayment: z.object({
    paidAmount: z.number().positive().optional(),
  }),

  bookWalkIn: z.object({
    patientPhone:    z.string().regex(/^(\+201[0125]\d{8}|01[0125]\d{8})$/, 'Invalid Egyptian phone number — must be 01XXXXXXXXX'),
    patientName:     z.string().min(2).max(100),
    notes:           z.string().max(500).optional(),
    appointmentType: z.enum(['new_consultation', 'follow_up', 'medical_rep']).optional(),
  }),

  bookOverride: z.object({
    patientPhone: z.string().regex(/^(\+201[0125]\d{8}|01[0125]\d{8})$/, 'Invalid Egyptian phone number — must be 01XXXXXXXXX'),
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

  // Token-based self-cancel — no auth required; token ownership is the proof
  async cancelByToken(req, res) {
    const Appointment  = (await import('../models/Appointment.js')).default;
    const { AppError } = await import('../utils/errors.js');

    const appointment = await Appointment.findOne({ accessToken: req.params.token })
      .populate('patientProfile', 'accountId');
    if (!appointment) throw new AppError('Appointment not found', 404);

    const patientAccountId = appointment.patientProfile?.accountId
      ? String(appointment.patientProfile.accountId)
      : null;

    const { appointment: updated, penaltyApplied, penaltyAmount } = await appointmentService.cancelAppointment({
      appointment,
      reason:           'Patient self-cancelled',
      patientAccountId,
    });
    res.json({ data: updated, penaltyApplied, penaltyAmount });
  },

  async getOwn(req, res) {
    const result = await appointmentService.getOwnAppointments({ actor: req.actor });
    res.json({ data: result });
  },

  async confirmPayment(req, res) {
    const appointment = req.resource;
    if (appointment.paymentMethod !== 'clinic') {
      return res.status(422).json({ error: 'Only clinic (pay-at-desk) appointments can be confirmed this way' });
    }
    if (appointment.paymentStatus === 'success') {
      return res.status(409).json({ error: 'Payment already confirmed' });
    }

    const DoctorBranchSchedule = (await import('../models/DoctorBranchSchedule.js')).default;
    const Session              = (await import('../models/QueueSession.js')).default;

    const session = await Session.findById(appointment.session).select('doctorBranchSchedule status').lean();
    const scheduleDoc = session
      ? await DoctorBranchSchedule.findById(session.doctorBranchSchedule).select('consultationFee').lean()
      : null;
    const fee = req.body.paidAmount ?? (scheduleDoc?.consultationFee?.amount ?? 0);

    // "Pay at clinic" bookings are held out of the active queue as
    // 'pending_confirmation' until a receptionist/doctor confirms the
    // payment here — at which point it joins the real queue as 'booked'.
    // Confirming payment on an already-booked/completed appointment (e.g.
    // the existing cash-at-checkout flow) only updates payment fields.
    let joinedQueue = false;
    if (appointment.status === 'pending_confirmation') {
      if (!session || !['scheduled', 'active'].includes(session.status)) {
        return res.status(409).json({ error: 'Session is no longer accepting patients' });
      }
      appointment.status = 'booked';
      joinedQueue = true;
    }

    appointment.paymentStatus = 'success';
    appointment.paidAt        = new Date();
    appointment.receivedBy    = req.actor.activeMembership._id;
    appointment.paidAmount    = fee;
    await appointment.save();

    if (joinedQueue) {
      try {
        await queueService.publishQueueUpdated(appointment.session);
      } catch { /* non-fatal — clients pick it up on next poll */ }
    }

    res.json({ data: appointment });
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

    const { appointment: updated, penaltyApplied, penaltyAmount } = await appointmentService.cancelAppointment({
      appointment,
      reason:           'Patient self-cancelled',
      patientAccountId: String(req.actor.account._id),
    });
    res.json({ data: updated, penaltyApplied, penaltyAmount });
  },

  // SSE endpoint: streams queue updates to the patient's live ticket (token-based, no auth)
  async trackSSE(req, res) {
    const Appointment = (await import('../models/Appointment.js')).default;
    const appointment = await Appointment.findOne({ accessToken: req.params.token })
      .select('session').lean();
    if (!appointment) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Appointment not found' });
      return;
    }

    res.writeHead(200, {
      'Content-Type':    'text/event-stream',
      'Cache-Control':   'no-cache',
      'Connection':      'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');

    const channel = `queue.session.${appointment.session}`;
    try {
      const sub = redis.duplicate();
      // A duplicated client does not inherit the parent's 'error' listener —
      // an EventEmitter with no 'error' listener throws and crashes the whole
      // process on connection failure (e.g. Redis down), independent of this
      // try/catch around the subscribe() promise. Must attach before any
      // command is issued on `sub`. ioredis retries in the background every
      // 200ms while Redis is down, re-emitting 'error' each time — log only
      // the first one per connection instead of flooding the console forever.
      let loggedError = false;
      sub.on('error', (err) => {
        if (loggedError) return;
        loggedError = true;
        console.warn('[appointments] SSE subscriber error:', describeRedisError(err));
      });
      await sub.subscribe(channel);

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
    } catch {
      // Redis unavailable — close stream so the client retries with backoff
      res.end();
    }
  },
};
