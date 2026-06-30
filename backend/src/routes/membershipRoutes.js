import { Router } from 'express';
import Organization from '../models/Organization.js';
import { Membership } from '../models/Membership.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { membershipController, inviteSchemas } from '../controllers/membershipController.js';

const router = Router();

// invites
router.post(
  '/',
  authenticate,
  validate(inviteSchemas.create),
  authorize('member.invite', async (req) => {
    const org = await Organization.findOne({ _id: req.params.id, status: 'active' });
    if (!org) return null;
    return { organization: org, invitedKind: req.body.kind };
  }),
  membershipController.inviteStaff,
);
router.get('/invites/:token', membershipController.lookupInvite);
router.post('/invites/accept/new', validate(inviteSchemas.acceptNew), membershipController.acceptInviteNew);
router.post('/invites/accept/existing', authenticate, validate(inviteSchemas.acceptExisting), membershipController.acceptInviteExisting);

// membership management
router.get(
  '/',
  authenticate,
  authorize('member.view', async (req) => Organization.findById(req.params.id)),
  membershipController.listMembers,
);

router.get(
  '/:membershipId',
  authenticate,
  authorize('member.view', async (req) => Membership.findById(req.params.membershipId)),
  membershipController.getMember,
);

router.patch(
  '/:membershipId',
  authenticate,
  validate(inviteSchemas.update),
  authorize('member.update', async (req) => Membership.findById(req.params.membershipId)),
  membershipController.updateMember,
);

router.patch(
  '/:membershipId/suspend',
  authenticate,
  authorize('member.suspend', async (req) => Membership.findById(req.params.membershipId)),
  membershipController.suspendMember,
);

router.patch(
  '/:membershipId/reactivate',
  authenticate,
  authorize('member.reactivate', async (req) => Membership.findById(req.params.membershipId)),
  membershipController.reactivateMember,
);

router.delete(
  '/:membershipId',
  authenticate,
  authorize('member.revoke', async (req) => Membership.findById(req.params.membershipId)),
  membershipController.revokeMember,
);

export default router;