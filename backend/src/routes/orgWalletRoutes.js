// routes/orgWalletRoutes.js
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import Organization from '../models/Organization.js';
import { walletController } from '../controllers/walletController.js';
import { payoutController } from '../controllers/payoutController.js';

const router = Router({ mergeParams: true });

const loadOrg = (req) =>
  Organization.findOne({ _id: req.params.orgId, status: { $ne: 'deleted' } });

router.get ('/',         authenticate, authorize('subscription.manage', loadOrg), walletController.getOrgWallet);
router.get ('/entries',  authenticate, authorize('subscription.manage', loadOrg), walletController.getOrgEntries);
router.post('/withdraw', authenticate, authorize('subscription.manage', loadOrg), payoutController.requestWithdrawal);
router.get ('/withdrawals', authenticate, authorize('subscription.manage', loadOrg), payoutController.listOrgPayouts);

export default router;