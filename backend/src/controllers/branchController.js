import { z } from 'zod';
import { branchService } from '../services/branchService.js';

const addressSchema = z.object({
  street:      z.string().optional(),
  city:        z.string().optional(),
  Governorate: z.string().optional(),
  country:     z.string().optional(),
  zip:         z.string().optional(),
}).optional();

const locationSchema = z.object({
  coordinates: z.tuple([z.number(), z.number()]),
}).optional();

export const branchSchemas = {
  create: z.object({
    name:     z.string().min(1).max(100),
    address:  addressSchema,
    location: locationSchema,
    phone:    z.string().optional(),
  }),

  update: z.object({
    name:          z.string().min(1).max(100).optional(),
    address:       addressSchema,
    location:      locationSchema,
    phone:         z.string().optional(),
    isActive:      z.boolean().optional(),
    commissionPct: z.number().min(0).max(100).optional(),
  }),
};

export const branchController = {
  async create(req, res) {
    const branch = await branchService.createBranch({
      orgId:  req.params.orgId,
      actor:  req.actor,
      data:   req.body,
    });
    res.status(201).json({ data: branch });
  },

  async list(req, res) {
    const isOrgMember = !!req.actor?.activeMembership;
    const includeInactive = req.query.includeInactive === 'true';
    const branches = await branchService.listBranches({
      orgId: req.params.orgId,
      isOrgMember,
      includeInactive,
    });
    res.json({ data: branches });
  },

  async get(req, res) {
    res.json({ data: req.resource });
  },

  async update(req, res) {
    const branch = await branchService.updateBranch({ branch: req.resource, data: req.body });
    res.json({ data: branch });
  },

  async delete(req, res) {
    await branchService.deleteBranch({ branch: req.resource });
    res.json({ ok: true });
  },
};
