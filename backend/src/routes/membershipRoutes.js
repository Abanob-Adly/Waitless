import { Router } from 'express';
import Organization from '../models/Organization.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/can.js';
import { validate } from '../middleware/validate.js';
import { membershipController, inviteSchemas } from '../controllers/membershipController.js';


const router = Router();

// invites
router.post(
  '/',
  authenticate,
  validate(inviteSchemas.create),
  authorize('member.invite', async (req) => {
    const org = await Organization.findOne({
      _id: req.params.id,
      status: 'active',
    });
    if (!org) return null;

    return {
      organization: org,
      invitedKind: req.body.kind,
    };
  }),
  membershipController.inviteStaff,
);
router.get('/invites/:token', membershipController.lookupInvite);
router.post('/invites/accept/new', validate(inviteSchemas.acceptNew), membershipController.acceptInviteNew);
router.post('/invites/accept/existing', authenticate, validate(inviteSchemas.acceptExisting), membershipController.acceptInviteExisting);



export default router;