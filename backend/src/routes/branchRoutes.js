import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { branchController, branchSchemas } from '../controllers/branchController.js';
import Branch from '../models/Branch.js';
import Organization from '../models/Organization.js';
import sessionRoutes from './sessionRoutes.js';

const router = Router({ mergeParams: true });

const loadOrg = (req) =>
  Organization.findOne({ _id: req.params.orgId, status: { $ne: 'deleted' } });

const loadBranch = (req) =>
  Branch.findOne({ _id: req.params.branchId, organization: req.params.orgId });

router.post(
  '/',
  authenticate,
  authorize('branch.create'),
  validate(branchSchemas.create),
  branchController.create
);

router.get(
  '/',
  optionalAuthenticate,
  authorize('branch.list', loadOrg),
  branchController.list
);

router.get(
  '/:branchId',
  optionalAuthenticate,
  authorize('branch.view', loadBranch),
  branchController.get
);

router.put(
  '/:branchId',
  authenticate,
  authorize('branch.update', loadBranch),
  validate(branchSchemas.update),
  branchController.update
);

router.delete(
  '/:branchId',
  authenticate,
  authorize('branch.delete', loadBranch),
  branchController.delete
);

// Sessions nested under branches
router.use('/:branchId/sessions', sessionRoutes);

export default router;
