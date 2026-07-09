import { z } from 'zod';
import Branch from '../models/Branch.js';
import { marketplaceService } from '../services/marketplaceService.js';

export const marketplaceSchemas = {
  book: z.object({
    paymentMethod: z.enum(['clinic', 'paymob']).optional(),
    notes:         z.string().max(500).optional(),
  }),
};

export const marketplaceController = {
  async searchOrgs(req, res) {
    const { query, type, city, page, limit } = req.query;
    const orgs = await marketplaceService.searchOrgs({ query, type, city, page, limit });
    res.json({ data: orgs });
  },

  async getOrg(req, res) {
    const org = req.resource;
    const branches = await Branch.find({ organization: org._id, isActive: true })
      .select('name address phone');
    res.json({ data: { ...org.toObject(), branches } });
  },

  async getDoctors(req, res) {
    const doctors = await marketplaceService.getPublicDoctors({ orgId: req.params.orgId });
    res.json({ data: doctors });
  },

  async getSessions(req, res) {
    const { doctorId, date } = req.query;
    const sessions = await marketplaceService.getAvailableSessions({
      orgId:    req.params.orgId,
      doctorId,
      date,
    });
    res.json({ data: sessions });
  },

  async getDoctorReviews(req, res) {
    const reviews = await marketplaceService.getPublicReviews({
      doctorMembershipId: req.params.doctorId,
    });
    res.json({ data: reviews });
  },

  async book(req, res) {
    const { appointment, accessToken } = await marketplaceService.bookMarketplace({
      actor:         req.actor,
      sessionId:     req.params.sessionId,
      paymentMethod: req.body.paymentMethod,
      notes:         req.body.notes,
    });
    res.status(201).json({ data: { appointment, accessToken } });
  },
};
