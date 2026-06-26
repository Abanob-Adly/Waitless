import mongoose from "mongoose";
import Organization from "../models/Organization.js";
import Subscription from "../models/Subscription.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import { AdminMembership } from "../models/Membership.js";
import { Conflict, NotFound } from "../utils/errors.js";

export const organizationService = {
  async create(actor, payload) {
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        const existing = await Organization.findOne({
          slug: payload.slug.toLowerCase(),
          status: { $ne: "deleted" },
        }).session(session);

        if (existing) {
          throw Conflict("Organization slug already exists");
        }

        const [org] = await Organization.create(
          [
            {
              name: payload.name,
              slug: payload.slug.toLowerCase(),
              type: payload.type,

              description: payload.description,

              contact: payload.contact,

              marketplaceProfile: {
                shortDescription: payload.marketplaceProfile?.shortDescription,
                specialties: payload.marketplaceProfile?.specialties ?? [],
                keywords: payload.marketplaceProfile?.keywords ?? [],
                gallery: payload.marketplaceProfile?.gallery ?? [],
              },

              logoUrl: payload.logoUrl,
              coverUrl: payload.coverUrl,

              isPublic: payload.isPublic ?? false,
            },
          ],
          { session },
        );

        await AdminMembership.create(
          [
            {
              account: actor.account._id,
              organization: org._id,

              status: "active",
              acceptedAt: new Date(),

              isSuper: true,
              permissions: ["*"],
            },
          ],
          { session },
        );

        const trialPlan = await SubscriptionPlan.findOne({
          name: "Trial",
          isActive: true,
        }).session(session);

        if (!trialPlan) {
          throw NotFound("Trial plan not configured");
        }

        const now = new Date();

        await Subscription.create(
          [
            {
              organization: org._id,
              plan: trialPlan._id,

              state: "trial",

              currentPeriodStart: now,
              currentPeriodEnd: new Date(
                now.getTime() + 14 * 24 * 60 * 60 * 1000,
              ),
            },
          ],
          { session },
        );

        return org;
      });
    } finally {
      await session.endSession();
    }
  },

  async listForAccount(accountId) {
    const memberships = await Membership.find({
      account: accountId,
      status: "active",
    })
      .populate("organization")
      .lean();

    return memberships.map((m) => ({
      membershipId: m._id,
      role: m.kind,
      organization: m.organization,
    }));
  },

  async getById(id) {
    const org = await Organization.findOne({
      _id: id,
      status: { $ne: "deleted" },
    });

    if (!org) throw NotFound("Organization not found");

    return org;
  },

  async getBySlug(slug) {
    const org = await Organization.findOne({
      slug: slug.toLowerCase(),
      status: "active",
      isPublic: true,
    });

    if (!org) {
      throw NotFound("Organization not found");
    }

    return org;
  },

  async update(orgId, payload) {
    const updates = {};

    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.type !== undefined) updates.type = payload.type;
    if (payload.description !== undefined)
      updates.description = payload.description;

    if (payload.logoUrl !== undefined) updates.logoUrl = payload.logoUrl;

    if (payload.coverUrl !== undefined) updates.coverUrl = payload.coverUrl;

    if (payload.contact !== undefined) updates.contact = payload.contact;

    if (payload.marketplaceProfile !== undefined)
      updates.marketplaceProfile = payload.marketplaceProfile;

    if (payload.isPublic !== undefined) updates.isPublic = payload.isPublic;

    const org = await Organization.findOneAndUpdate(
      {
        _id: orgId,
        status: { $ne: "deleted" },
      },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!org) {
      throw NotFound("Organization not found");
    }

    return org;
  },

  async remove(id) {
    const org = await Organization.findOneAndUpdate(
      {
        _id: id,
        status: { $ne: "deleted" },
      },
      {
        $set: {
          status: "deleted",
          deletedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!org) throw NotFound("Organization not found");

    return org;
  },
};
