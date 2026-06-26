import { z } from "zod";
import { inviteService } from "../services/invite.js";
import { tokenService } from "../services/token.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const email = z.string().email().toLowerCase();

const createAdminInvite = z.object({
  kind: z.literal("admin"),
  inviteEmail: email,
  permissions: z.array(z.string().min(1)).default(["*"]),
  isSuper: z.boolean().default(false),
});

const createDoctorInvite = z.object({
  kind: z.literal("doctor"),
  inviteEmail: email,
  specialties: z.array(z.string().min(1).max(100)).default([]),
  services: z.array(z.string().min(1).max(100)).default([]),
  licenseNumber: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(2000).optional(),
});

const createReceptionistInvite = z.object({
  kind: z.literal("receptionist"),
  inviteEmail: email,
  branches: z.array(objectId).min(1),
});

export const inviteSchemas = {
  create: z.discriminatedUnion("kind", [
    createAdminInvite,
    createDoctorInvite,
    createReceptionistInvite,
  ]),
  acceptNew: z.object({
    token: z.string(),
    fullName: z.string().min(2),
    password: z.string().min(8),
    phone: z.string().optional(),
  }),
  acceptExisting: z.object({ token: z.string() }),
};

const serializeMembership = (m) => ({
  id: m._id,
  organization: m.organization,
  kind: m.kind,
  status: m.status,
  inviteEmail: m.inviteEmail,
  invitedBy: m.invitedBy,
  inviteToken: m.inviteToken,
  inviteExpiresAt: m.inviteExpiresAt,
  permissions: m.permissions,
  isSuper: m.isSuper,
  specialties: m.specialties,
  services: m.services,
  licenseNumber: m.licenseNumber,
  bio: m.bio,
  branches: m.branches,
  acceptedAt: m.acceptedAt,
});

export const membershipController = {
  async inviteStaff(req, res) {
    const result = await inviteService.createInvite({
      organizationId: req.params.id,
      actorId: req.actor.account._id,
      payload: req.body,
    });

    res.status(201).json({
      membership: serializeMembership(result.membership),
      inviteUrl: `/members/invites/${result.inviteToken}`,
    });
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
