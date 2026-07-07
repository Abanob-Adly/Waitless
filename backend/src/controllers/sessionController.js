import { z } from 'zod';
import { sessionService } from '../services/sessionService.js';
import { AppError, Forbidden, NotFound } from '../utils/errors.js';

export const sessionSchemas = {
  generate: z.object({
    scheduleId: z.string(),
    fromDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
    toDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  }),
  patch: z.object({
    maxBookings: z.number().int().min(1).nullable().optional(),
  }),
  submitExcuse: z.object({
    reason: z.string().min(5).max(500),
  }),
  reviewExcuse: z.object({
    verdict: z.enum(['approved', 'denied']),
  }),
};

export const sessionController = {
  async generate(req, res) {
    const result = await sessionService.generateSessions({
      scheduleId: req.body.scheduleId,
      orgId:      req.params.orgId,
      fromDate:   req.body.fromDate,
      toDate:     req.body.toDate,
    });
    res.status(201).json({ data: result });
  },

  async list(req, res) {
    const sessions = await sessionService.listSessions({
      branchId: req.params.branchId,
      orgId:    req.params.orgId,
      filters:  req.query,
    });
    res.json({ data: sessions });
  },

  async get(req, res) {
    res.json({ data: req.resource });
  },

  async start(req, res) {
    const session = await sessionService.startSession({ session: req.resource });
    res.json({ data: session });
  },

  async end(req, res) {
    const session = await sessionService.endSession({ session: req.resource });
    res.json({ data: session });
  },

  async patch(req, res) {
    const session = req.resource;
    if (req.body.maxBookings !== undefined) {
      session.maxBookings = req.body.maxBookings ?? null;
    }
    await session.save();
    // Re-populate doctor so adaptSession has fullName available immediately.
    await session.populate({ path: 'doctor', select: 'kind specialties account', populate: { path: 'account', select: 'fullName' } });
    res.json({ data: session });
  },

  // Doctor submits a late-start excuse before/after penalty fires.
  async submitExcuse(req, res) {
    const session = req.resource;
    if (!session) throw NotFound('Session not found');

    // Only the owning doctor may submit an excuse.
    const m = req.actor.activeMembership;
    if (!m || (m.kind !== 'doctor' && m.kind !== 'admin')) throw Forbidden();
    if (m.kind === 'doctor' && !m._id.equals(session.doctor)) throw Forbidden();

    if (session.excuse?.status === 'approved') {
      throw new AppError('Excuse already approved', 409);
    }

    session.excuse = {
      submittedAt: new Date(),
      reason:      req.body.reason,
      status:      'pending',
      reviewedAt:  null,
      reviewedBy:  null,
    };
    await session.save();
    res.json({ data: { excuse: session.excuse } });
  },

  // Admin reviews (approve / deny) a pending excuse.
  async reviewExcuse(req, res) {
    const session = req.resource;
    if (!session) throw NotFound('Session not found');

    const m = req.actor.activeMembership;
    if (!m || m.kind !== 'admin') throw Forbidden('Only admins can review excuses');

    if (!session.excuse?.submittedAt) {
      throw new AppError('No excuse has been submitted for this session', 409);
    }

    session.excuse.status     = req.body.verdict;
    session.excuse.reviewedAt = new Date();
    session.excuse.reviewedBy = m._id;

    await session.save();
    res.json({ data: { excuse: session.excuse } });
  },
};
