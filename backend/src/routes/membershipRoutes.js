import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { membershipController, inviteSchemas } from '../controllers/membershipController.js';

const router = Router();

router.get('/invites/:token', membershipController.lookupInvite);
router.post('/invites/accept/new', validate(inviteSchemas.acceptNew), membershipController.acceptInviteNew);
router.post('/invites/accept/existing', authenticate, validate(inviteSchemas.acceptExisting),
    membershipController.acceptInviteExisting);

export default router;