import { z } from 'zod';
import { sessionService } from '../services/sessionService.js';

export const sessionSchemas = {
  generate: z.object({
    scheduleId: z.string(),
    fromDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
    toDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  }),
  patch: z.object({
    maxBookings: z.number().int().min(1).nullable().optional(),
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
    res.json({ data: session });
  },
};
