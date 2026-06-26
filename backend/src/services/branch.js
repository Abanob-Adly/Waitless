import mongoose from "mongoose";
import Branch from "../models/Branch.js";
import Organization from "../models/Organization.js";
import Subscription from "../models/Subscription.js";
import { Conflict, Forbidden, NotFound } from "../utils/errors.js";

const ACTIVE_SUBSCRIPTION_STATES = ["trial", "active"];
const ALLOWED_WRITE_STATES = ["trial", "active"];

function isPlatformAdmin(actor) {
  return Boolean(actor?.isPlatformAdmin);
}

function isOrgAdmin(actor, orgId) {
  return (
    actor?.activeMembership &&
    actor.activeMembership.kind === "admin" &&
    actor.activeMembership.status === "active" &&
    actor.activeOrgId?.equals(orgId)
  );
}

function hasBranchManagePermission(actor) {
  const perms = actor?.activeMembership?.permissions || [];
  return perms.includes("*") || perms.includes("branch.manage");
}

function canManageBranches(actor, orgId) {
  return (
    isPlatformAdmin(actor) ||
    (isOrgAdmin(actor, orgId) && hasBranchManagePermission(actor))
  );
}

function toPublicBranch(branch) {
  return {
    id: branch._id,
    name: branch.name,
    address: branch.address
      ? {
          city: branch.address.city,
          Governorate: branch.address.Governorate,
          country: branch.address.country,
          street: branch.address.street,
          zip: branch.address.zip,
        }
      : undefined,
    location: branch.location,
  };
}

async function loadActiveOrg(orgId) {
  const org = await Organization.findOne({
    _id: orgId,
    status: { $ne: "deleted" },
  });

  if (!org) throw NotFound("Organization not found");
  return org;
}

async function loadSubscription(orgId) {
  const sub = await Subscription.findOne({
    organization: orgId,
    state: { $in: ["trial", "active", "past_due"] },
  }).populate("plan");

  if (!sub) throw NotFound("Subscription not found");
  return sub;
}

function assertCanWriteForSubscription(subscription) {
  if (!ALLOWED_WRITE_STATES.includes(subscription.state)) {
    throw Forbidden("Organization subscription does not allow this action");
  }
}

function assertPlanAllowsBranchCreation(subscription, currentBranchCount) {
  const plan = subscription.plan;
  const maxBranches = plan?.limits?.maxBranches ?? 0;

  if (currentBranchCount >= maxBranches) {
    throw Forbidden("Branch limit reached for current plan");
  }
}

function assertOrgScoped(actor, orgId) {
  if (isPlatformAdmin(actor)) return;
  if (!actor?.activeOrgId?.equals(orgId)) {
    throw Forbidden(
      "This action is only allowed inside your active organization",
    );
  }
}

export const branchService = {
  async list({ actor, organizationId }) {
    const org = await loadActiveOrg(organizationId);

    const canViewPrivately =
      isPlatformAdmin(actor) || isOrgAdmin(actor, org._id);

    if (!org.isPublic && !canViewPrivately) {
      throw Forbidden("Organization is private");
    }

    const branches = await Branch.find({
      organization: org._id,
      isActive: true,
    }).sort({ createdAt: 1 }).lean();

    if (canViewPrivately) {
      return branches;
    }

    return branches.map(toPublicBranch);
  },

  async get({ actor, branchId }) {
    const branch = await Branch.findById(branchId).populate(
      "organization",
      "name slug isPublic status",
    );

    if (!branch) throw NotFound("Branch not found");

    const org = branch.organization;
    const canViewPrivately =
      isPlatformAdmin(actor) ||
      (actor?.activeOrgId && actor.activeOrgId.equals(org._id));

    if (!org.isPublic && !canViewPrivately) {
      throw Forbidden("Branch is private");
    }

    if (canViewPrivately) {
      return branch;
    }

    return toPublicBranch(branch);
  },

  async create({ actor, organizationId, name, address, location, phone }) {
    assertOrgScoped(actor, organizationId);

    const org = await loadActiveOrg(organizationId);
    if (!canManageBranches(actor, org._id)) {
      throw Forbidden("Not allowed to create branches");
    }

    const subscription = await loadSubscription(org._id);
    assertCanWriteForSubscription(subscription);

    const currentBranchCount = await Branch.countDocuments({
      organization: org._id,
      isActive: true,
    });

    assertPlanAllowsBranchCreation(subscription, currentBranchCount);

    const branch = await Branch.create({
      organization: org._id,
      name,
      address,
      location,
      phone,
      isActive: true,
    });

    return branch;
  },

  async update({ actor, branch, updates }) {
    const existing = branch || (await Branch.findById(updates?.branchId));
    if (!existing) throw NotFound("Branch not found");

    const org = await loadActiveOrg(existing.organization);

    if (!canManageBranches(actor, org._id)) {
      throw Forbidden("Not allowed to update branches");
    }

    const subscription = await loadSubscription(org._id);
    assertCanWriteForSubscription(subscription);

    const allowed = {};
    if (updates.name !== undefined) allowed.name = updates.name;
    if (updates.address !== undefined) allowed.address = updates.address;
    if (updates.location !== undefined) allowed.location = updates.location;
    if (updates.phone !== undefined) allowed.phone = updates.phone;
    if (updates.isActive !== undefined) allowed.isActive = updates.isActive;

    const updated = await Branch.findByIdAndUpdate(
      existing._id,
      { $set: allowed },
      { new: true, runValidators: true },
    );

    if (!updated) throw NotFound("Branch not found");
    return updated;
  },

  async remove({ actor, branch }) {
    const existing = branch || null;
    if (!existing) throw NotFound("Branch not found");

    const org = await loadActiveOrg(existing.organization);

    if (!canManageBranches(actor, org._id)) {
      throw Forbidden("Not allowed to delete branches");
    }

    const subscription = await loadSubscription(org._id);
    assertCanWriteForSubscription(subscription);

    const removed = await Branch.findByIdAndUpdate(
      existing._id,
      { $set: { isActive: false } },
      { new: true },
    );

    if (!removed) throw NotFound("Branch not found");
    return removed;
  },
};
