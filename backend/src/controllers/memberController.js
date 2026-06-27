import { z } from 'zod';
import { memberService } from '../services/memberService.js';

export const memberSchemas = {
  invite: z.object({
    email:              z.string().email().toLowerCase(),
    kind:               z.enum(['admin', 'doctor', 'receptionist']),
    specialties:        z.array(z.string()).optional(),
    licenseNumber:      z.string().optional(),
    bio:                z.string().max(2000).optional(),
    branches:           z.array(z.string()).optional(),
    permissions:        z.array(z.string()).optional(),
    yearsOfExperience:  z.number().int().min(0).optional(),
    languagesSpoken:    z.array(z.string()).optional(),
    websiteUrl:         z.string().url().nullable().optional(),
    acceptedInsurances: z.array(z.string().max(100)).optional(),
  }),

  update: z.object({
    specialties:        z.array(z.string()).optional(),
    licenseNumber:      z.string().optional(),
    bio:                z.string().max(2000).optional(),
    services:           z.array(z.string()).optional(),
    branches:           z.array(z.string()).optional(),
    permissions:        z.array(z.string()).optional(),
    yearsOfExperience:  z.number().int().min(0).optional(),
    languagesSpoken:    z.array(z.string()).optional(),
    websiteUrl:         z.string().url().nullable().optional(),
    acceptedInsurances: z.array(z.string().max(100)).optional(),
  }),
};

export const memberController = {
  async invite(req, res) {
    const result = await memberService.inviteMember({
      actor:  req.actor,
      orgId:  req.params.orgId,
      data:   req.body,
    });
    res.status(201).json({ data: result });
  },

  async list(req, res) {
    const members = await memberService.listMembers({
      orgId:   req.params.orgId,
      filters: req.query,
    });
    res.json({ data: members });
  },

  async get(req, res) {
    const member = await memberService.getMember({ membership: req.resource });
    res.json({ data: member });
  },

  async update(req, res) {
    const member = await memberService.updateMember({ membership: req.resource, data: req.body });
    res.json({ data: member });
  },

  async revoke(req, res) {
    await memberService.revokeMember({ membership: req.resource });
    res.json({ ok: true });
  },
};
