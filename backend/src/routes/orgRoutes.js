import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { orgController, orgSchemas } from '../controllers/orgController.js';
import Organization from '../models/Organization.js';
import branchRoutes from './branchRoutes.js';
import memberRoutes from './memberRoutes.js';
import scheduleRoutes from './scheduleRoutes.js';
import patientRoutes from './patientRoutes.js';

const router = Router();

const loadOrg = (req) =>
  Organization.findOne({ _id: req.params.orgId, status: { $ne: 'deleted' } });

// Public: list all active subscription plans (before /:orgId to avoid param capture)
router.get('/plans', orgController.listPlans);

router.post(
  '/',
  authenticate,
  authorize('organization.create'),
  validate(orgSchemas.create),
  orgController.create
);

router.get(
  '/:orgId',
  optionalAuthenticate,
  authorize('organization.view', loadOrg),
  orgController.get
);

router.put(
  '/:orgId',
  authenticate,
  authorize('organization.update', loadOrg),
  validate(orgSchemas.update),
  orgController.update
);

router.patch(
  '/:orgId/visibility',
  authenticate,
  authorize('organization.toggle_public', loadOrg),
  validate(orgSchemas.visibility),
  orgController.toggleVisibility
);

router.get(
  '/:orgId/subscription',
  authenticate,
  authorize('organization.view', loadOrg),
  orgController.getSubscription
);

router.post(
  '/:orgId/subscription/upgrade',
  authenticate,
  authorize('organization.update', loadOrg),
  validate(orgSchemas.upgrade),
  orgController.upgradePlan
);

// Nested resource routers
router.use('/:orgId/branches', branchRoutes);
router.use('/:orgId/members', memberRoutes);
router.use('/:orgId/schedules', scheduleRoutes);
router.use('/:orgId/patients', patientRoutes);

export default router;
