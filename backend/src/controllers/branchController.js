import { z } from "zod";
import { branchService } from "../services/branch.js";

const phone = z
  .string()
  .regex(/^\+?[1-9]\d{7,14}$/)
  .optional();

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  Governorate: z.string().optional(),
  country: z.string().optional(),
  zip: z.string().optional(),
});

// Strict GeoJSON point validation for 2dsphere indexing
const locationSchema = z.object({
  type: z.literal("Point").default("Point"),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude [0]
    z.number().min(-90).max(90), // latitude [1]
  ]),
});

export const branchSchemas = {
  create: z.object({
    // Added to match Mongoose required field and index
    organization: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Organization ID"),
    name: z.string().trim().min(2).max(100),
    address: addressSchema.optional(),
    location: locationSchema.optional(),
    phone,
  }),

  update: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    address: addressSchema.optional(),
    location: locationSchema.optional(),
    phone,
    isActive: z.boolean().optional(),
}),
};

export const branchController = {
  async list(req, res) {
    const branches = await branchService.list({
      actor: req.actor,
      organizationId: req.params.orgId,
    });

    res.json(branches);
  },

  async get(req, res) {
    const branch = await branchService.get({
      actor: req.actor,
      branchId: req.params.branchId,
    });

    res.json(branch);
  },

  async create(req, res) {
    const branch = await branchService.create({
      actor: req.actor,
      organizationId: req.params.orgId,
      ...req.body,
    });

    res.status(201).json(branch);
  },

  async update(req, res) {
    const branch = await branchService.update({
      actor: req.actor,
      branch: req.resource, // loaded by authorize()
      updates: req.body,
    });

    res.json(branch);
  },

  async remove(req, res) {
    await branchService.remove({
      actor: req.actor,
      branch: req.resource,
    });

    res.status(204).send();
  },
};
