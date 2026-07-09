import { Membership, AdminMembership, DoctorMembership, ReceptionistMembership } from '../models/Membership.js';
import Account from '../models/Account.js';
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

  const { maxDoctors, maxAdmins, maxReceptionists } = sub.plan.limits;

  if (kind === 'doctor' && maxDoctors != null) {
    const count = await Membership.countDocuments({ organization: orgId, kind: 'doctor', status: 'active' });
    if (count >= maxDoctors) throw Forbidden(`Doctor limit reached for your plan (max ${maxDoctors}). Upgrade to add more.`);
  }
  if (kind === 'admin' && maxAdmins != null) {
    const count = await Membership.countDocuments({ organization: orgId, kind: 'admin', status: 'active' });
    if (count >= maxAdmins) throw Forbidden(`Admin limit reached for your plan (max ${maxAdmins}). Upgrade to add more.`);
  }
  if (kind === 'receptionist') {
    if (maxReceptionists != null && maxReceptionists === 0) {
      throw Forbidden('Receptionists are not available on your current plan. Upgrade to Standard or higher.');
    }
    if (maxReceptionists != null && maxReceptionists > 0) {
      const count = await Membership.countDocuments({ organization: orgId, kind: 'receptionist', status: 'active' });
      if (count >= maxReceptionists) throw Forbidden(`Receptionist limit reached for your plan (max ${maxReceptionists}). Upgrade to add more.`);
    }
  }
}

export const memberService = {
  async inviteMember({ actor, orgId, data }) {
    await checkMemberLimit(orgId, data.kind);

    const existingInvite = await Membership.findOne({
      organization: orgId,
      inviteEmail: data.email,
      status: "pending",
    });
    if (existingInvite)
      throw Conflict("An invite for this email is already pending");

    const inviteToken = generateToken(32);
    const expiresAt = new Date(
      Date.now() + env.invite.ttlDays * 24 * 60 * 60 * 1000,
    );

    const MemberModel = DISCRIMINATOR_MAP[data.kind];
    const memberData = {
      organization: orgId,
      status: "pending",
      invitedBy: actor.account._id,
      inviteToken,
      inviteEmail: data.email,
      inviteExpiresAt: expiresAt,
    };

    if (data.kind === "doctor") {
      memberData.specialties = data.specialties || [];
      memberData.licenseNumber = data.licenseNumber;
      memberData.bio = data.bio;
      memberData.yearsOfExperience = data.yearsOfExperience ?? null;
      memberData.languagesSpoken = data.languagesSpoken || [];
      memberData.websiteUrl = data.websiteUrl ?? null;
      memberData.acceptedInsurances = data.acceptedInsurances || [];
    } else if (data.kind === "receptionist") {
      memberData.branches = data.branches || [];
    } else if (data.kind === "admin") {
      memberData.permissions = data.permissions || [];
      memberData.isSuper = false;
    }

    const membership = await MemberModel.create(memberData);

    const acceptLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/accept-invite?token=${inviteToken}`;

    // Human-readable role label
    const roleLabel =
      {
        admin: "Administrator",
        doctor: "Doctor",
        receptionist: "Receptionist",
      }[data.kind] || "Team Member";

    // Inviter display name (fallback safely if not populated)
    const inviterName =
      actor.account?.fullName ||
      actor.account?.email ||
      "Your organization admin";

    const orgName = actor.membership?.organization?.name || "your organization";

    // Expiry in days (matches the token TTL)
    const expiresInDays = env.invite.ttlDays;

    const subject = `You've been invited to join ${orgName} as a ${roleLabel}`;

    const body = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#f6f8fb; padding:24px; color:#1f2937;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:28px 32px; background:#0ea5e9; color:#ffffff;">
              <h1 style="margin:0; font-size:20px; font-weight:600;">You're invited!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px; font-size:15px; line-height:1.6;">
                Hi there,
              </p>
              <p style="margin:0 0 16px; font-size:15px; line-height:1.6;">
                <strong>${inviterName}</strong> has invited you to join
                <strong>${orgName}</strong> as a <strong>${roleLabel}</strong>.
              </p>
              <p style="margin:0 0 24px; font-size:15px; line-height:1.6;">
                Click the button below to accept your invitation and set up your account.
              </p>
              <p style="text-align:center; margin:0 0 24px;">
                <a href="${acceptLink}"
                  style="display:inline-block; padding:12px 24px; background:#0ea5e9; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px;">
                  Accept invitation
                </a>
              </p>
              <p style="margin:0 0 8px; font-size:13px; color:#6b7280; line-height:1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px; font-size:13px; word-break:break-all;">
                <a href="${acceptLink}" style="color:#0ea5e9;">${acceptLink}</a>
              </p>
              <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
              <p style="margin:0 0 8px; font-size:12px; color:#6b7280; line-height:1.6;">
                This invitation will expire in <strong>${expiresInDays} day${expiresInDays === 1 ? "" : "s"}</strong>.
                If you weren't expecting this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

    await emailProvider.send({
      to: data.email,
      subject,
      body,
    });

    return {
      membershipId: membership._id,
      inviteEmail: data.email,
      inviteToken,
    };
  },

  async listMembers({ orgId, filters }) {
    const query = { organization: orgId, status: { $ne: "revoked" } };
    if (filters.kind) query.kind = String(filters.kind);
    if (filters.status) query.status = String(filters.status);

    const page = Math.max(1, parseInt(filters.page || 1));
    const limit = Math.min(100, parseInt(filters.limit || 20));

    const members = await Membership.find(query)
      .populate("account", "fullName email avatarUrl")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    return members;
  },

  async getMember({ membership }) {
    return Membership.findById(membership._id).populate(
      "account",
      "fullName email avatarUrl",
    );
  },

  async updateMember({ membership, data }) {
    const { kind } = membership;

    // Role change: discriminator kind cannot be mutated in-place; revoke current + create new.
    if (data.kind && data.kind !== kind) {
      // Enforce 30-day rate limit on role changes
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      if (membership.lastRoleChangeAt) {
        const msSinceLastChange =
          Date.now() - membership.lastRoleChangeAt.getTime();
        if (msSinceLastChange < THIRTY_DAYS_MS) {
          const nextAllowed = new Date(
            membership.lastRoleChangeAt.getTime() + THIRTY_DAYS_MS,
          );
          throw Forbidden(
            `Role was last changed on ${membership.lastRoleChangeAt.toDateString()}. ` +
              `Next change allowed after ${nextAllowed.toDateString()}.`,
          );
        }
      }

      await checkMemberLimit(String(membership.organization), data.kind);

      // Receptionist role requires at least one branch — fail early before revoking
      if (data.kind === "receptionist" && !(data.branches?.length > 0)) {
        throw Forbidden(
          "Receptionists must be assigned to at least one branch. Use the invite flow to set the branch.",
        );
      }

      const prevStatus = membership.status;
      membership.status = "revoked";
      await membership.save();

      const MemberModel = DISCRIMINATOR_MAP[data.kind];
      const now = new Date();
      const newData = {
        account: membership.account,
        organization: membership.organization,
        status: "active",
        acceptedAt: now,
        inviteEmail: membership.inviteEmail,
        invitedBy: membership.invitedBy,
        lastRoleChangeAt: now,
      };

      if (data.kind === "doctor") {
        newData.specialties = data.specialties ?? [];
        newData.bio = data.bio ?? "";
        newData.licenseNumber = "";
      } else if (data.kind === "receptionist") {
        newData.branches = data.branches;
      } else if (data.kind === "admin") {
        newData.permissions = data.permissions ?? ["*"];
        newData.isSuper = false;
      }

      try {
        return await MemberModel.create(newData);
      } catch (createErr) {
        // Revert the revoke so the account isn't left memberless
        membership.status = prevStatus;
        await membership.save().catch(() => {});
        throw createErr;
      }
    }

    // Field update for same role
    if (kind === "doctor") {
      const allowed = [
        "specialties",
        "bio",
        "licenseNumber",
        "services",
        "yearsOfExperience",
        "languagesSpoken",
        "websiteUrl",
        "acceptedInsurances",
        "avatarUrl",
      ];
      for (const k of allowed)
        if (data[k] !== undefined) membership[k] = data[k];
      if (data.avatarUrl !== undefined && membership.account) {
        await Account.findByIdAndUpdate(membership.account, {
          avatarUrl: data.avatarUrl,
        });
      }
    } else if (kind === "receptionist") {
      if (data.branches !== undefined) membership.branches = data.branches;
    } else if (kind === "admin") {
      if (data.permissions !== undefined)
        membership.permissions = data.permissions;
    }

    await membership.save();
    return membership;
  },

  async revokeMember({ membership }) {
    // A still-pending invite has no account yet (that's what "pending" means),
    // but `account` becomes schema-required the moment status flips to
    // "revoked" — saving that transition always fails validation. There's no
    // real member to revoke here anyway, just an unaccepted invite token, so
    // delete it outright instead of trying to "revoke" it.
    if (membership.status === "pending") {
      await membership.deleteOne();
      return { ok: true };
    }

    membership.status = "revoked";
    await membership.save();
    if (membership.account) {
      await tokenService.revokeAllForAccount(membership.account);
    }
    return { ok: true };
  },
};
