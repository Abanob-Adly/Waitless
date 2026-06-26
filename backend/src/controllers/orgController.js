import { z } from "zod";
import { organizationService } from "../services/org.js";

export const organizationSchemas = {
  create: z.object({
    name: z.string().min(2).max(200),
    slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),

    type: z.enum(["clinic", "hospital"]),

    description: z.string().max(2000).optional(),

    isPublic: z.boolean().optional(),

    contact: z
      .object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
        website: z.string().url().optional(),
      })
      .optional(),
  }),

  update: z.object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional(),

    logoUrl: z.string().url().optional(),
    coverUrl: z.string().url().optional(),

    isPublic: z.boolean().optional(),

    contact: z
      .object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
        website: z.string().url().optional(),
      }).optional(),
  }),
};

export const organizationController = {
  async create(req, res) {
    const organization = await organizationService.create(
      req.actor,
      req.body,
    );
    res.status(201).json({
      organizationId: organization._id,
    });
  },

  async list(req, res) {
    const organizations =
      await organizationService.listForAccount(
        req.actor.account._id,
      );

    res.json(organizations);
  },

  async getById(req, res) {
    res.json(req.resource);
  },

  async update(req, res) {
    const organization =
      await organizationService.update(
        req.params.id,
        req.body,
      );

    res.json(organization);
  },

  async remove(req, res) {
    await organizationService.remove(req.params.id);

    res.status(204).send();
  },
};
