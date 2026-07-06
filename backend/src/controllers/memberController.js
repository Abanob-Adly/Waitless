import { z } from 'zod';
import { memberService } from '../services/memberService.js';
import { AdminMembership, DoctorMembership, Membership } from '../models/Membership.js';
import { Forbidden, NotFound } from '../utils/errors.js';

const VALID_SPECIALTIES = [
  'Cardiology','Dermatology','Pediatrics','Orthopedics','Internal Medicine',
  'Neurology','Ophthalmology','ENT','Obstetrics & Gynecology','Psychiatry',
  'Dentistry','Urology','Endocrinology','Rheumatology','Oncology',
  'General Surgery','Radiology','Physical Therapy','General',
];
const SpecialtyItem = z.string().refine((s) => VALID_SPECIALTIES.includes(s), {
  message: 'Invalid specialty. Must be one of the predefined medical specialties.',
});

export const memberSchemas = {
  invite: z.object({
    email:              z.string().email().toLowerCase(),
    kind:               z.enum(['admin', 'doctor', 'receptionist']),
    specialties:        z.array(SpecialtyItem).optional(),
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
    kind:               z.enum(['admin', 'doctor', 'receptionist']).optional(),
    specialties:        z.array(SpecialtyItem).optional(),
    licenseNumber:      z.string().optional(),
    bio:                z.string().max(2000).optional(),
    services:           z.array(z.string()).optional(),
    branches:           z.array(z.string()).optional(),
    permissions:        z.array(z.string()).optional(),
    yearsOfExperience:  z.number().int().min(0).optional(),
    languagesSpoken:    z.array(z.string()).optional(),
    websiteUrl:         z.string().url().nullable().optional(),
    avatarUrl:          z.string().max(2048).nullable().optional(),
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
  // Promotes a doctor to also be an admin (multi-role). Receptionists are not eligible.
  async grantAdmin(req, res) {
    const { orgId, memberId } = req.params;
    // req.resource is the authorize policy context object, not the membership —
    // load the source membership directly.
    const sourceMembership = await Membership.findOne({ _id: memberId, organization: orgId });
    if (!sourceMembership?.account) throw NotFound('Member not found');

    if (sourceMembership.kind === 'receptionist') {
      throw Forbidden('Receptionists are not eligible for the admin role');
    }

    // Check for ANY existing admin membership including revoked ones.
    // The unique index {account, organization, kind} prevents creating a second doc —
    // if a revoked one exists we must reactivate it instead of inserting a new one.
    const anyExisting = await Membership.findOne({
      account:      sourceMembership.account,
      organization: orgId,
      kind:         'admin',
    });

    if (anyExisting) {
      if (anyExisting.status !== 'revoked') {
        return res.json({ data: anyExisting }); // already active — idempotent
      }
      anyExisting.status      = 'active';
      anyExisting.acceptedAt  = new Date();
      anyExisting.permissions = ['*'];
      await anyExisting.save();
      return res.json({ data: anyExisting });
    }

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
    const { orgId, memberId } = req.params;
    const sourceMembership = await Membership.findOne({ _id: memberId, organization: orgId });
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
