import { z } from 'zod';
import { memberService } from '../services/memberService.js';
import { AdminMembership, DoctorMembership, Membership } from '../models/Membership.js';
import { NotFound } from '../utils/errors.js';

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

  // POST /orgs/:orgId/members/:memberId/grant-admin
  // Promotes a doctor/receptionist to also be an admin (multi-role)
  async grantAdmin(req, res) {
    const { orgId } = req.params;
    const sourceMembership = req.resource;
    if (!sourceMembership?.account) throw NotFound('Member not found');

    const existing = await Membership.findOne({
      account:      sourceMembership.account,
      organization: orgId,
      kind:         'admin',
      status:       { $ne: 'revoked' },
    });
    if (existing) return res.json({ data: existing }); // idempotent

    const adminMembership = await AdminMembership.create({
      account:      sourceMembership.account,
      organization: orgId,
      status:       'active',
      acceptedAt:   new Date(),
      permissions:  ['*'],
    });
    res.status(201).json({ data: adminMembership });
  },

  // DELETE /orgs/:orgId/members/:memberId/grant-admin
  // Revokes admin role while keeping doctor/receptionist role
  async revokeAdmin(req, res) {
    const { orgId } = req.params;
    const sourceMembership = req.resource;
    if (!sourceMembership?.account) throw NotFound('Member not found');

    const adminMembership = await Membership.findOne({
      account:      sourceMembership.account,
      organization: orgId,
      kind:         'admin',
    });
    if (!adminMembership) return res.json({ ok: true }); // idempotent

    adminMembership.status = 'revoked';
    await adminMembership.save();
    res.json({ ok: true });
  },

  // POST /orgs/:orgId/members/self/doctor
  // Allows an authenticated admin to also enrol as a doctor in their own org
  async selfJoinAsDoctor(req, res) {
    const { orgId } = req.params;
    const accountId = req.actor.account._id;

    const existing = await Membership.findOne({
      account:      accountId,
      organization: orgId,
      kind:         'doctor',
      status:       { $ne: 'revoked' },
    });
    if (existing) return res.json({ data: existing }); // idempotent

    const doctorMembership = await DoctorMembership.create({
      account:       accountId,
      organization:  orgId,
      status:        'active',
      acceptedAt:    new Date(),
      specialties:   Array.isArray(req.body.specialties) ? req.body.specialties : [],
      bio:           req.body.bio ?? '',
      licenseNumber: req.body.licenseNumber ?? '',
    });
    res.status(201).json({ data: doctorMembership });
  },
};
