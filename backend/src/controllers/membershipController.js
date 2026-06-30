import { z } from 'zod';
import { inviteService } from '../services/invite.js';
import { membershipService } from '../services/membership.js';
import { tokenService } from '../services/token.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const email = z.string().email().toLowerCase();

const adminInvite = z.object({
  kind: z.literal('admin'),
  inviteEmail: email,
  permissions: z.array(z.string().min(1)).default(['*']),
  isSuper: z.boolean().default(false),
});

const doctorInvite = z.object({
  kind: z.literal('doctor'),
  inviteEmail: email,
  specialties: z.array(z.string().min(1)).default([]),
  services: z.array(z.string().min(1)).default([]),
  licenseNumber: z.string().trim().optional(),
  bio: z.string().trim().max(2000).optional(),
});

const receptionistInvite = z.object({
  kind: z.literal('receptionist'),
  inviteEmail: email,
  branches: z.array(objectId).min(1),
});

export const inviteSchemas = {
  create: z.discriminatedUnion('kind', [adminInvite, doctorInvite, receptionistInvite]),
  acceptNew: z.object({
    token: z.string(),
    fullName: z.string().min(2),
    password: z.string().min(8),
    phone: z.string().optional(),
  }),
  acceptExisting: z.object({ token: z.string() }),

  update: z
    .object({
      kind: z.enum(['admin', 'doctor', 'receptionist']).optional(),
      permissions: z.array(z.string().min(1)).optional(),
      isSuper: z.boolean().optional(),
      specialties: z.array(z.string().min(1)).optional(),
      services: z.array(z.string().min(1)).optional(),
      licenseNumber: z.string().trim().optional(),
      bio: z.string().trim().max(2000).optional(),
      branches: z.array(objectId).optional(),
    })
    .strict(),
};

const publicMembership = (m) => ({
  id: m._id,
  organization: m.organization,
  kind: m.kind,
  status: m.status,
  account: m.account,
  invitedBy: m.invitedBy,
  inviteEmail: m.inviteEmail,
  inviteExpiresAt: m.inviteExpiresAt,
  acceptedAt: m.acceptedAt,
  permissions: m.permissions,
  isSuper: m.isSuper,
  specialties: m.specialties,
  services: m.services,
  licenseNumber: m.licenseNumber,
  bio: m.bio,
  branches: m.branches,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
});

export const membershipController = {
  async inviteStaff(req, res) {
    const result = await inviteService.createInvite({
      organizationId: req.params.id,
      actorId: req.actor.account._id,
      payload: req.body,
    });

    res.status(201).json({
      membership: publicMembership(result.membership),
      inviteToken: result.inviteToken,
    });
  },

  async listMembers(req, res) {
    const rows = await membershipService.list(req.params.id, req.query);
    res.json({ items: rows.map(publicMembership) });
  },

  async getMember(req, res) {
    const membership = await membershipService.get(req.params.membershipId);
    res.json({ membership: publicMembership(membership) });
  },

  async updateMember(req, res) {
    const membership = await membershipService.update(req.params.membershipId, req.body, req.actor);
    res.json({ membership: publicMembership(membership) });
  },

  async suspendMember(req, res) {
    const membership = await membershipService.suspend(req.params.membershipId, req.actor);
    res.json({ membership: publicMembership(membership) });
  },

  async reactivateMember(req, res) {
    const membership = await membershipService.reactivate(req.params.membershipId, req.actor);
    res.json({ membership: publicMembership(membership) });
  },

  async revokeMember(req, res) {
    const membership = await membershipService.revoke(req.params.membershipId, req.actor);
    res.json({ membership: publicMembership(membership) });
  },

  async lookupInvite(req, res) {
    const m = await inviteService.lookup({ token: req.params.token });
    res.json({
      organization: m.organization,
      kind: m.kind,
      inviteEmail: m.inviteEmail,
    });
  },

  async acceptInviteNew(req, res) {
    const { account, membership } = await inviteService.acceptWithNewAccount(req.body);

    const accessToken = tokenService.signAccessToken(account, membership.organization);
    const refreshToken = await tokenService.issueRefreshToken(account._id, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({ accessToken, refreshToken });
  },

  async acceptInviteExisting(req, res) {
    const { account, membership } = await inviteService.acceptWithExistingAccount({
      token: req.body.token,
      accountId: req.actor.account._id,
    });

    const accessToken = tokenService.signAccessToken(account, membership.organization);
    res.json({ accessToken, membershipId: membership._id });
  },
};