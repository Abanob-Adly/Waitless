import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import Organization from '../models/Organization.js';
import { paymentController } from '../controllers/paymentController.js';

const router = Router({ mergeParams: true });

const loadOrg = (req) =>
  Organization.findOne({ _id: req.params.orgId, status: { $ne: 'deleted' } });

// Subscription checkout — mounted under /organizations/:orgId/billing
router.post(
  '/checkout',
  authenticate,
  authorize('organization.manage', loadOrg),
  paymentController.subscriptionCheckout,
);

// Post-checkout result page (client polls this after redirect)
router.get('/result', authenticate, paymentController.result);

export default router;