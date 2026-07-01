import { z } from 'zod';
import { scheduleService } from '../services/scheduleService.js';
import { sessionService } from '../services/sessionService.js';

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format HH:MM'),
  endTime:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format HH:MM'),
});

const feeSchema = z.object({
  amount:   z.number().min(0),
  currency: z.string().default('EGP'),
}).optional();

export const scheduleSchemas = {
  create: z.object({
    doctorMembershipId: z.string(),
    branchId:           z.string(),
    schedule:           z.array(slotSchema).min(1),
    avgConsultationMin: z.number().int().min(1),
    consultationFee:    feeSchema,
    defaultMaxBookings: z.number().int().min(1).nullable().optional(),
  }),

  update: z.object({
    schedule:           z.array(slotSchema).optional(),
    avgConsultationMin: z.number().int().min(1).optional(),
    consultationFee:    feeSchema,
    status:             z.enum(['active', 'inactive']).optional(),
    defaultMaxBookings: z.number().int().min(1).nullable().optional(),
  }),

  createException: z.object({
    date:   z.string().datetime(),
    reason: z.enum(['sick', 'leave', 'emergency', 'other']).default('other'),
    note:   z.string().max(500).optional(),
  }),
};

export const scheduleController = {
  async create(req, res) {
    const schedule = await scheduleService.createSchedule({ orgId: req.params.orgId, data: req.body });

    // Auto-generate sessions for the next 14 days
    const today = new Date();
    const fromDate = today.toISOString().slice(0, 10);
    const toDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let sessionsGenerated = 0;
    try {
      const result = await sessionService.generateSessions({
        scheduleId: schedule._id.toString(),
        orgId: req.params.orgId,
        fromDate,
        toDate,
      });
      sessionsGenerated = result.created ?? 0;
    } catch (_err) {
      // Non-fatal: sessions can be generated separately
    }

    res.status(201).json({ data: { schedule, sessionsGenerated } });
  },

  async list(req, res) {
    const schedules = await scheduleService.listSchedules({ orgId: req.params.orgId, filters: req.query });
    res.json({ data: schedules });
  },

  async get(req, res) {
    res.json({ data: req.resource });
  },

  async update(req, res) {
    const schedule = await scheduleService.updateSchedule({ schedule: req.resource, data: req.body });

    // When the weekly pattern changes, cancel stale sessions and regenerate for the next 14 days.
    // avgConsultationMin-only or fee-only edits don't need this (scheduleService handles those).
    let sessionsGenerated = 0;
    if (req.body.schedule !== undefined && req.body.status !== 'inactive') {
      const today = new Date();
      const fromDate = today.toISOString().slice(0, 10);
      const toDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      try {
        const result = await sessionService.generateSessions({
          scheduleId: schedule._id.toString(),
          orgId:      req.params.orgId,
          fromDate,
          toDate,
        });
        sessionsGenerated = result.created ?? 0;
      } catch (_err) {
        // Non-fatal: stale sessions were cancelled; new ones will appear via daily job
      }
    }

    res.json({ data: schedule, sessionsGenerated });
  },

  async delete(req, res) {
    await scheduleService.deleteSchedule({ schedule: req.resource });
    res.json({ ok: true });
  },

  async createException(req, res) {
    const exception = await scheduleService.createException({
      schedule:       req.resource,
      data:           req.body,
      actorAccountId: req.actor.account._id,
    });
    res.status(201).json({ data: exception });
  },

  async listExceptions(req, res) {
    const exceptions = await scheduleService.listExceptions({
      scheduleId: req.params.scheduleId,
      filters:    req.query,
    });
    res.json({ data: exceptions });
  },

  async deleteException(req, res) {
    await scheduleService.deleteException({ exception: req.resource });
    res.json({ ok: true });
  },
};
