import { z } from 'zod';
import JoinRequest from '../models/JoinRequest.js';
import Organization from '../models/Organization.js';
import { DoctorMembership } from '../models/Membership.js';
import { Conflict, Forbidden, NotFound } from '../utils/errors.js';
import { getActiveSubscription } from '../utils/subscription.js';

export const joinRequestSchemas = {
  submit: z.object({
    specialties:   z.array(z.string()).optional(),
    bio:           z.string().max(2000).optional(),
    licenseNumber: z.string().max(100).optional(),
    message:       z.string().max(500).optional(),
  }),
  resolve: z.object({
    action: z.enum(['approve', 'reject']),
  }),
};

export const joinRequestController = {
  // POST /orgs/:orgId/join-requests
  // Any authenticated worker (staff) can submit
  async submit(req, res) {
    const { orgId } = req.params;
    const accountId = req.actor.account._id;

    const org = await Organization.findOne({ _id: orgId, status: { $ne: 'deleted' } });
    if (!org) throw NotFound('Organization not found');

    const existing = await JoinRequest.findOne({
      account: accountId,
      organization: orgId,
      status: 'pending',
    });
    if (existing) throw Conflict('You already have a pending request for this organization');

    const request = await JoinRequest.create({
      account:      accountId,
      organization: orgId,
      specialties:  req.body.specialties ?? [],
      bio:          req.body.bio ?? '',
      licenseNumber: req.body.licenseNumber ?? '',
      message:      req.body.message ?? '',
    });

    res.status(201).json({ data: request });
  },

  // GET /orgs/:orgId/join-requests?status=pending
  // Admin only (enforced by authorize middleware)
  async list(req, res) {
    const { orgId } = req.params;
    const status = req.query.status ?? 'pending';

    const requests = await JoinRequest.find({ organization: orgId, status })
      .populate('account', 'fullName email phone')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: requests });
  },

  // PATCH /orgs/:orgId/join-requests/:requestId
  // Admin only
  async resolve(req, res) {
    const { orgId, requestId } = req.params;
    const { action } = req.body;

    const request = await JoinRequest.findOne({ _id: requestId, organization: orgId });
    if (!request) throw NotFound('Join request not found');
    if (request.status !== 'pending') throw Conflict('Request has already been resolved');

    if (action === 'approve') {
      // Check subscription doctor limit
      const sub = await getActiveSubscription(orgId);
      if (sub?.plan?.limits?.maxDoctors != null) {
        const { Membership } = await import('../models/Membership.js');
        const count = await Membership.countDocuments({ organization: orgId, kind: 'doctor', status: 'active' });
        if (count >= sub.plan.limits.maxDoctors) {
          throw Forbidden('Doctor limit reached for your plan');
        }
      }

      await DoctorMembership.create({
        account:      request.account,
        organization: orgId,
        status:       'active',
        acceptedAt:   new Date(),
        specialties:  request.specialties,
        bio:          request.bio,
        licenseNumber: request.licenseNumber,
      });

      request.status     = 'approved';
      request.resolvedBy = req.actor.account._id;
      request.resolvedAt = new Date();
    } else {
      request.status     = 'rejected';
      request.resolvedBy = req.actor.account._id;
      request.resolvedAt = new Date();
    }

    await request.save();
    res.json({ data: request });
  },

  // GET /auth/me/join-requests  (called from doctor/staff perspective)
  async listMine(req, res) {
    const accountId = req.actor.account._id;
    const requests = await JoinRequest.find({ account: accountId })
      .populate('organization', 'name type')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ data: requests });
  },
};
