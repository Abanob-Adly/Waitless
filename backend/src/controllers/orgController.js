import { z } from 'zod';
import { orgService } from '../services/orgService.js';

const contactSchema = z.object({
  email:   z.string().email().optional(),
  phone:   z.string().optional(),
  website: z.string().url().optional(),
}).optional();

export const orgSchemas = {
  create: z.object({
    name:        z.string().min(2).max(100),
    slug:        z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
    type:        z.enum(['clinic', 'hospital', 'polyclinic']),
    description: z.string().max(2000).optional(),
    logoUrl:     z.string().url().optional(),
    coverUrl:    z.string().url().optional(),
    contact:     contactSchema,
    isPublic:    z.boolean().optional(),
  }),

  update: z.object({
    name:           z.string().min(2).max(100).optional(),
    type:           z.enum(['clinic', 'hospital', 'polyclinic']).optional(),
    description:    z.string().max(2000).optional(),
    logoUrl:        z.string().url().optional(),
    coverUrl:       z.string().url().optional(),
    contact:        contactSchema,
    isPublic:       z.boolean().optional(),
    whatsappNumber: z.string().max(20).nullable().optional(),
  }),

  visibility: z.object({
    isPublic: z.boolean(),
  }),

  upgrade: z.object({
    planId: z.string().min(1),
  }),
};

export const orgController = {
  async create(req, res) {
    const { org, accessToken } = await orgService.createOrg({ actor: req.actor, data: req.body });
    res.status(201).json({ data: { org, accessToken } });
  },

  async get(req, res) {
    const { org, subscription } = await orgService.getOrg({ org: req.resource });
    res.json({ data: { org, subscription } });
  },

  async update(req, res) {
    const org = await orgService.updateOrg({ org: req.resource, data: req.body });
    res.json({ data: org });
  },

  async toggleVisibility(req, res) {
    const org = await orgService.toggleVisibility({ org: req.resource, isPublic: req.body.isPublic });
    res.json({ data: org });
  },

  async getSubscription(req, res) {
    const sub = await orgService.getSubscription({ org: req.resource });
    if (!sub) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'No active subscription found' });
    }
    res.json({ data: sub });
  },

  async listPlans(_req, res) {
    const plans = await orgService.listPlans();
    res.json({ data: plans });
  },

  async upgradePlan(req, res) {
    const sub = await orgService.upgradePlan({ org: req.resource, planId: req.body.planId });
    res.json({ data: sub });
  },
};
