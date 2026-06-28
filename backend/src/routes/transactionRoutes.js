import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { transactionController } from '../controllers/transactionController.js';
import Organization from '../models/Organization.js';

const router = Router({ mergeParams: true });

const loadOrg = (req) =>
  Organization.findOne({ _id: req.params.orgId, status: { $ne: 'deleted' } });

router.get(
  '/summary',
  authenticate,
  authorize('organization.view', loadOrg),
  transactionController.summary,
);

router.get(
  '/',
  authenticate,
  authorize('organization.view', loadOrg),
  transactionController.list,
);

export default router;
