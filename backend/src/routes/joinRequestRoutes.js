import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { joinRequestController, joinRequestSchemas } from '../controllers/joinRequestController.js';
import Organization from '../models/Organization.js';

const router = Router({ mergeParams: true });

const loadOrg = (req) =>
  Organization.findOne({ _id: req.params.orgId, status: { $ne: 'deleted' } });

// Any authenticated worker can submit a join request
router.post(
  '/',
  authenticate,
  validate(joinRequestSchemas.submit),
  joinRequestController.submit,
);

// Admin: list incoming requests
router.get(
  '/',
  authenticate,
  authorize('member.list', loadOrg),
  joinRequestController.list,
);

// Admin: approve or reject
router.patch(
  '/:requestId',
  authenticate,
  authorize('member.invite', loadOrg),
  validate(joinRequestSchemas.resolve),
  joinRequestController.resolve,
);

export default router;
