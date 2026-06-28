import { Membership, AdminMembership, DoctorMembership, ReceptionistMembership } from '../models/Membership.js';
import { getActiveSubscription } from '../utils/subscription.js';
import { generateToken } from '../utils/otp.js';
import { emailProvider } from './providers/email.js';
import { tokenService } from './token.js';
import { env } from '../config/env.js';
import { Conflict, Forbidden, NotFound } from '../utils/errors.js';

const DISCRIMINATOR_MAP = {
  admin:        AdminMembership,
  doctor:       DoctorMembership,
  receptionist: ReceptionistMembership,
};

async function checkMemberLimit(orgId, kind) {
  const sub = await getActiveSubscription(orgId);

  if (!sub?.plan) return;

  const { maxDoctors, maxReceptionists } = sub.plan.limits;

  if (kind === 'doctor' && maxDoctors != null) {
    const count = await Membership.countDocuments({ organization: orgId, kind: 'doctor', status: 'active' });
    if (count >= maxDoctors) throw Forbidden('Doctor limit reached for your plan');
  }
  if (kind === 'receptionist' && maxReceptionists != null) {
    const count = await Membership.countDocuments({ organization: orgId, kind: 'receptionist', status: 'active' });
    if (count >= maxReceptionists) throw Forbidden('Receptionist limit reached for your plan');
  }
}

export const memberService = {
  async inviteMember({ actor, orgId, data }) {
    await checkMemberLimit(orgId, data.kind);

    const existingInvite = await Membership.findOne({
      organization: orgId,
      inviteEmail: data.email,
      status: 'pending',
    });
    if (existingInvite) throw Conflict('An invite for this email is already pending');

    const inviteToken = generateToken(32);
    const expiresAt = new Date(Date.now() + env.invite.ttlDays * 24 * 60 * 60 * 1000);

    const MemberModel = DISCRIMINATOR_MAP[data.kind];
    const memberData = {
      organization:    orgId,
      status:          'pending',
      invitedBy:       actor.account._id,
      inviteToken,
      inviteEmail:     data.email,
      inviteExpiresAt: expiresAt,
    };

    if (data.kind === 'doctor') {
      memberData.specialties         = data.specialties || [];
      memberData.licenseNumber       = data.licenseNumber;
      memberData.bio                 = data.bio;
      memberData.yearsOfExperience   = data.yearsOfExperience ?? null;
      memberData.languagesSpoken     = data.languagesSpoken || [];
      memberData.websiteUrl          = data.websiteUrl ?? null;
      memberData.acceptedInsurances  = data.acceptedInsurances || [];
    } else if (data.kind === 'receptionist') {
      memberData.branches = data.branches || [];
    } else if (data.kind === 'admin') {
      memberData.permissions = data.permissions || [];
      memberData.isSuper     = false;
    }

    const membership = await MemberModel.create(memberData);

    const acceptLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invite?token=${inviteToken}`;
    // MOCK EMAIL — swap back to emailProvider.send() when RESEND_API_KEY is configured
    console.log(`[MOCK EMAIL] Invite sent to ${data.email} | role: ${data.kind}`);

    return { membershipId: membership._id, inviteEmail: data.email, inviteToken };
  },

  async listMembers({ orgId, filters }) {
    const query = { organization: orgId };
    if (filters.kind)   query.kind   = filters.kind;
    if (filters.status) query.status = filters.status;

    const page  = Math.max(1, parseInt(filters.page  || 1));
    const limit = Math.min(100, parseInt(filters.limit || 20));

    const members = await Membership.find(query)
      .populate('account', 'fullName email avatarUrl')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    return members;
  },

  async getMember({ membership }) {
    return Membership.findById(membership._id).populate('account', 'fullName email avatarUrl');
  },

  async updateMember({ membership, data }) {
    const { kind } = membership;

    if (kind === 'doctor') {
      const allowed = ['specialties', 'bio', 'licenseNumber', 'services', 'yearsOfExperience', 'languagesSpoken', 'websiteUrl', 'acceptedInsurances'];
      for (const k of allowed) if (data[k] !== undefined) membership[k] = data[k];
    } else if (kind === 'receptionist') {
      if (data.branches !== undefined) membership.branches = data.branches;
    } else if (kind === 'admin') {
      if (data.permissions !== undefined) membership.permissions = data.permissions;
    }

    await membership.save();
    return membership;
  },

  async revokeMember({ membership }) {
    membership.status = 'revoked';
    await membership.save();
    if (membership.account) {
      await tokenService.revokeAllForAccount(membership.account);
    }
    return { ok: true };
  },
};
