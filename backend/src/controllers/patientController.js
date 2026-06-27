import { z } from 'zod';
import { patientService } from '../services/patientService.js';

export const patientSchemas = {
  create: z.object({
    fullName:    z.string().min(2).max(100),
    phone:       z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'),
    gender:      z.enum(['male', 'female']).optional(),
    dateOfBirth: z.string().datetime().optional(),
    branchId:    z.string().optional(),
  }),

  update: z.object({
    fullName:    z.string().min(2).max(100).optional(),
    phone:       z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
    gender:      z.enum(['male', 'female']).optional(),
    dateOfBirth: z.string().datetime().optional(),
  }),

  updateOwn: z.object({
    fullName:    z.string().min(2).max(100).optional(),
    phone:       z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
    gender:      z.enum(['male', 'female']).optional(),
    dateOfBirth: z.string().optional(),
    avatarUrl:   z.string().url().optional().nullable(),
  }),
};

export const patientController = {
  async create(req, res) {
    const profile = await patientService.createProfile({
      orgId:    req.params.orgId,
      branchId: req.body.branchId,
      data:     req.body,
    });
    res.status(201).json({ data: profile });
  },

  async list(req, res) {
    const profiles = await patientService.listProfiles({ orgId: req.params.orgId, filters: req.query });
    res.json({ data: profiles });
  },

  async get(req, res) {
    res.json({ data: req.resource });
  },

  async update(req, res) {
    const profile = await patientService.updateProfile({ profile: req.resource, data: req.body });
    res.json({ data: profile });
  },

  async getOwn(req, res) {
    const profile = await patientService.getOwnProfile({ accountId: req.actor.account._id });
    res.json({ data: profile });
  },

  async updateOwn(req, res) {
    const profile = await patientService.updateOwnProfile({ accountId: req.actor.account._id, data: req.body });
    res.json({ data: profile });
  },

  async getHistory(req, res) {
    const history = await patientService.getPatientHistory({ profileId: req.params.profileId });
    res.json({ data: history });
  },
};
