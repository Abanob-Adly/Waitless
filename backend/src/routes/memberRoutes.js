import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { memberController, memberSchemas } from '../controllers/memberController.js';
import { Membership } from '../models/Membership.js';

const router = Router({ mergeParams: true });

const loadMember = (req) =>
  Membership.findOne({ _id: req.params.memberId, organization: req.params.orgId });

router.post(
  '/invite',
  authenticate,
  authorize('member.invite', (req) => ({ invitedKind: req.body?.kind })),
  validate(memberSchemas.invite),
  memberController.invite
);

router.get(
  '/',
  authenticate,
  authorize('member.list'),
  memberController.list
);

router.get(
  '/:memberId',
  authenticate,
  authorize('member.view', loadMember),
  memberController.get
);

router.put(
  '/:memberId',
  authenticate,
  authorize('member.update', loadMember),
  validate(memberSchemas.update),
  memberController.update
);

router.delete(
  '/:memberId',
  authenticate,
  authorize('member.revoke', loadMember),
  memberController.revoke
);

// Promote a staff member to also hold admin role (multi-role)
router.post(
  '/:memberId/grant-admin',
  authenticate,
  authorize('member.invite', () => ({ invitedKind: 'admin' })),
  memberController.grantAdmin
);

router.delete(
  '/:memberId/grant-admin',
  authenticate,
  authorize('member.invite', () => ({ invitedKind: 'admin' })),
  memberController.revokeAdmin
);

// Self-enrol as doctor — authenticated admin joins own org as a doctor too
router.post(
  '/self/doctor',
  authenticate,
  authorize('member.invite', () => ({ invitedKind: 'doctor' })),
  memberController.selfJoinAsDoctor
);

export default router;
