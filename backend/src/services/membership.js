import { Membership, AdminMembership, DoctorMembership, ReceptionistMembership } from '../models/Membership.js';
import Branch from '../models/Branch.js';
import { AppError, Conflict, Forbidden, NotFound } from '../utils/errors.js';

const safeAccountFields = 'email phone fullName avatarUrl role status isEmailVerified isPhoneVerified';
const safeOrgFields = 'name slug status isPublic';
const allowedKinds = new Set(['admin', 'doctor', 'receptionist']);

function assertObjectId(id) {
  if (!id || !/^[a-f\d]{24}$/i.test(String(id))) {
    throw new AppError('Invalid id', 400);
  }
}

function kindOf(doc) {
  return doc?.kind || doc?.constructor?.modelName || null;
}

async function loadTargetMembership(id) {
  assertObjectId(id);

  const membership = await Membership.findById(id)
    .populate('account', safeAccountFields)
    .populate('organization', safeOrgFields)
    .populate('invitedBy', safeAccountFields);

  if (!membership) throw NotFound('Membership not found');
  return membership;
}

function ensureSameOrg(actor, target) {
  if (!actor?.activeMembership) throw Forbidden();
  if (!actor.activeOrgId?.equals(target.organization._id || target.organization)) {
    throw Forbidden();
  }
}

async function ensureAnotherSuperExists(orgId, excludingMembershipId) {
  const count = await AdminMembership.countDocuments({
    organization: orgId,
    status: 'active',
    isSuper: true,
    _id: { $ne: excludingMembershipId },
  });

  if (count < 1) {
    throw Forbidden('Cannot remove the last super admin');
  }
}

function pickUpdatePatch(target, body) {
  const k = kindOf(target);

  if (k === 'admin') {
    return {
      permissions: body.permissions,
      isSuper: body.isSuper,
    };
  }

  if (k === 'doctor') {
    return {
      specialties: body.specialties,
      services: body.services,
      licenseNumber: body.licenseNumber,
      bio: body.bio,
    };
  }

  if (k === 'receptionist') {
    return {
      branches: body.branches,
    };
  }

  throw AppError('Unsupported membership kind', 400);
}

export const membershipService = {
  async list(orgId, { kind, status, branch } = {}) {
    assertObjectId(orgId);

    const query = { organization: orgId };
    if (kind) query.kind = kind;
    if (status) query.status = status;

    if (branch) {
      assertObjectId(branch);
      query.kind = 'receptionist';
      query.branches = branch;
    }

    return Membership.find(query)
      .sort({ createdAt: -1 })
      .populate('account', safeAccountFields)
      .populate('organization', safeOrgFields)
      .populate('invitedBy', safeAccountFields)
      .populate('branches', 'name organization isActive');
  },

  async get(membershipId) {
    return loadTargetMembership(membershipId);
  },

  async update(membershipId, body, actor) {
    const target = await loadTargetMembership(membershipId);
    ensureSameOrg(actor, target);

    if (body.kind && body.kind !== target.kind) {
      throw Forbidden('Membership kind cannot be changed');
    }

    const kind = kindOf(target);
    const patch = pickUpdatePatch(target, body);

    if (kind === 'admin') {
      if (Object.prototype.hasOwnProperty.call(body, 'permissions') || Object.prototype.hasOwnProperty.call(body, 'isSuper')) {
        if (!actor.isPlatformAdmin && !actor.activeMembership?.isSuper) {
          throw Forbidden();
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, 'isSuper') && target.isSuper && body.isSuper === false) {
        await ensureAnotherSuperExists(target.organization._id || target.organization, target._id);
      }
    }

    if (kind === 'receptionist' && Array.isArray(body.branches)) {
      const branchCount = await Branch.countDocuments({
        _id: { $in: body.branches },
        organization: target.organization._id || target.organization,
        isActive: true,
      });

      if (branchCount !== body.branches.length) {
        throw Forbidden('One or more branches do not belong to this organization');
      }
    }

    if (kind === 'doctor' && target.account && actor.account._id.equals(target.account._id)) {
      const allowedSelfFields = ['bio'];
      const keys = Object.keys(body).filter((k) => body[k] !== undefined);
      if (!keys.every((k) => allowedSelfFields.includes(k))) {
        throw Forbidden('Doctors can only update their own bio here');
      }
    }

    Object.entries(patch).forEach(([key, value]) => {
      if (value !== undefined) target[key] = value;
    });

    await target.save();
    return loadTargetMembership(target._id);
  },

  async suspend(membershipId, actor) {
    const target = await loadTargetMembership(membershipId);
    ensureSameOrg(actor, target);

    if (target.status === 'suspended') return target;

    if (target.kind === 'admin' && target.isSuper) {
      await ensureAnotherSuperExists(target.organization._id || target.organization, target._id);
    }

    target.status = 'suspended';
    await target.save();
    return loadTargetMembership(target._id);
  },

  async reactivate(membershipId, actor) {
    const target = await loadTargetMembership(membershipId);
    ensureSameOrg(actor, target);

    if (target.status !== 'suspended') {
      throw Forbidden('Only suspended memberships can be reactivated');
    }

    target.status = 'active';
    await target.save();
    return loadTargetMembership(target._id);
  },

  async revoke(membershipId, actor) {
    const target = await loadTargetMembership(membershipId);
    ensureSameOrg(actor, target);

    if (actor.account._id.equals(target.account)) {
      throw Forbidden('Cannot revoke your own membership');
    }

    if (target.kind === 'admin' && target.isSuper) {
      await ensureAnotherSuperExists(target.organization._id || target.organization, target._id);
    }

    target.status = 'revoked';
    target.inviteToken = null;
    target.inviteExpiresAt = null;
    await target.save();

    return loadTargetMembership(target._id);
  },
};