import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { marketplaceController, marketplaceSchemas } from '../controllers/marketplaceController.js';
import Organization from '../models/Organization.js';

const router = Router();

const loadPublicOrg = (req) =>
  Organization.findOne({ _id: req.params.orgId, isPublic: true, status: 'active' });

router.get('/orgs', optionalAuthenticate, marketplaceController.searchOrgs);

router.get(
  '/orgs/:orgId',
  optionalAuthenticate,
  authorize('organization.view', loadPublicOrg),
  marketplaceController.getOrg
);

router.get('/orgs/:orgId/doctors',  optionalAuthenticate, marketplaceController.getDoctors);
router.get('/orgs/:orgId/doctors/:doctorId/reviews', optionalAuthenticate, marketplaceController.getDoctorReviews);
router.get('/orgs/:orgId/sessions', optionalAuthenticate, marketplaceController.getSessions);

router.post(
  '/sessions/:sessionId/book',
  authenticate,
  authorize('appointment.book_marketplace'),
  validate(marketplaceSchemas.book),
  marketplaceController.book
);

export default router;
