import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { organizationController, organizationSchemas } from '../controllers/orgController.js';
import Organization from '../models/Organization.js';

const router = Router();

router.get('/', authenticate, organizationController.list );
router.post('/', authenticate, authorize('organization.create'), validate(organizationSchemas.create), organizationController.create);

router.get(
  "/:id",
  authenticate,
  authorize("organization.view", (req) => Organization.findById(req.params.id)),
  organizationController.getById,
);

router.delete(
  "/:id",
  authenticate,
  authorize("organization.delete", (req) =>
    Organization.findById(req.params.id),
  ),
  organizationController.remove,
);

router.patch(
  "/:id",
  authenticate,
  authorize("organization.update", (req) =>
    Organization.findById(req.params.id),
  ),
  validate(organizationSchemas.update),
  organizationController.update,
);

export default router;
