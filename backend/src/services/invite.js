import mongoose from 'mongoose';
import Account from '../models/account.js';
import Organization from '../models/Organization.js';
import Branch from '../models/Branch.js';
import { Membership, AdminMembership, DoctorMembership, ReceptionistMembership } from '../models/Membership.js';
import crypto from 'crypto';
import { env } from './config/env.js';
import { hashPassword } from '../utils/password.js';
import { AppError, Conflict, Forbidden, NotFound } from '../utils/errors.js';

const INVITE_TTL_MS = env.invite.ttlDays * 24 * 60 * 60 * 1000;
const normalizeEmail = (value) => value.trim().toLowerCase();
const generateInviteToken = () => crypto.randomBytes(24).toString('hex');

export const inviteService = {
  async createInvite({ organizationId, actorId, payload }) {
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        const org = await Organization.findOne({
          _id: organizationId,
          status: "active",
        }).session(session);

        if (!org) throw NotFound("Organization not found");

        const inviteEmail = normalizeEmail(payload.inviteEmail);
        const now = new Date();

        const existingAccount = await Account.findOne({
          email: inviteEmail,
          status: { $ne: "deleted" },
        }).session(session);

        if (existingAccount) {
          const alreadyMember = await Membership.findOne({
            organization: org._id,
            account: existingAccount._id,
            status: "active",
          }).session(session);

          if (alreadyMember) {
            throw Conflict("Member already exists");
          }
        }

        const pendingInvite = await Membership.findOne({
          organization: org._id,
          kind: payload.kind,
          inviteEmail,
          status: "pending",
          inviteToken: { $ne: null },
          inviteExpiresAt: { $gt: now },
        }).session(session);

        if (pendingInvite) {
          throw Conflict("Invite already exists");
        }

        if (payload.kind === "receptionist") {
          const foundBranches = await Branch.find({
            _id: { $in: payload.branches },
            organization: org._id,
            isActive: true,
          }).session(session);

          if (foundBranches.length !== payload.branches.length) {
            throw Forbidden(
              "One or more branches do not belong to this organization",
            );
          }
        }

        const inviteToken = generateInviteToken();
        const inviteExpiresAt = new Date(now.getTime() + INVITE_TTL_MS);

        const base = {
          organization: org._id,
          status: "pending",
          invitedBy: actorId,
          inviteEmail,
          inviteToken,
          inviteExpiresAt,
        };

        let membership;

        if (payload.kind === "admin") {
          [membership] = await AdminMembership.create(
            [
              {
                ...base,
                permissions: payload.permissions ?? ["*"],
                isSuper: payload.isSuper ?? false,
              },
            ],
            { session },
          );
        } else if (payload.kind === "doctor") {
          [membership] = await DoctorMembership.create(
            [
              {
                ...base,
                specialties: payload.specialties ?? [],
                services: payload.services ?? [],
                licenseNumber: payload.licenseNumber ?? null,
                bio: payload.bio ?? null,
              },
            ],
            { session },
          );
        } else if (payload.kind === "receptionist") {
          [membership] = await ReceptionistMembership.create(
            [
              {
                ...base,
                branches: payload.branches,
              },
            ],
            { session },
          );
        } else {
          throw new AppError("Unsupported membership kind", 400);
        }

        return { membership, inviteToken, organization: org };
      });
    } finally {
      session.endSession();
    }
  },

  async lookup({ token, session = null }) {
    let query = Membership.findOne({
      inviteToken: token,
      status: "pending",
    }).populate("organization", "name slug status");

    if (session) query = query.session(session);

    const membership = await query;

    if (!membership) throw NotFound("Invite not found");
    if (membership.inviteExpiresAt < new Date())
      throw new AppError("Invite expired", 410);
    if (
      !membership.organization ||
      membership.organization.status !== "active"
    ) {
      throw Forbidden("Organization is not active");
    }

    return membership;
  },

  async acceptWithNewAccount({ token, fullName, password, phone }) {
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        const membership = await this.lookup({ token, session });

        if (
          await Account.findOne({ email: membership.inviteEmail }).session(
            session,
          )
        ) {
          throw Conflict(
            "Account already exists — please log in and accept the invite",
          );
        }

        const [account] = await Account.create(
          [
            {
              email: membership.inviteEmail,
              phone,
              fullName,
              passwordHash: await hashPassword(password),
              role: "staff",
              status: "active",
              isEmailVerified: true,
            },
          ],
          { session },
        );

        await this._finalizeAccept({ membership, account, session });
        return { membership, account };
      });
    } finally {
      session.endSession();
    }
  },

  async acceptWithExistingAccount({ token, accountId }) {
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        const membership = await this.lookup({ token, session });
        const account = await Account.findById(accountId).session(session);

        if (!account) throw NotFound("Account not found");

        if (
          account.email.toLowerCase() !== membership.inviteEmail.toLowerCase()
        ) {
          throw Forbidden("This invite was sent to a different email");
        }

        await this._finalizeAccept({ membership, account, session });
        return { membership, account };
      });
    } finally {
      session.endSession();
    }
  },

  async _finalizeAccept({ membership, account, session }) {
    membership.account = account._id;
    membership.status = "active";
    membership.acceptedAt = new Date();
    membership.inviteToken = null;
    membership.inviteExpiresAt = null;
    await membership.save({ session });
  },
};