import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { walletController } from '../controllers/walletController.js';
import { paymentController } from '../controllers/paymentController.js';

const loadOrg = (req) =>
  Organization.findOne({ _id: req.params.orgId, status: { $ne: 'deleted' } });

const router = Router();

// Personal wallet (patient and staff/doctor)
router.get  ('/me',           authenticate, walletController.getMyWallet);
router.post('/me/topup',      authenticate, paymentController.walletTopup);
router.post('/:orgId/topup',  authenticate, authorize('organization.manage', loadOrg), paymentController.orgWalletTopup);

router.post ('/me/purchase',  authenticate, walletController.purchaseAtBooking);
router.get  ('/me/entries',   authenticate, walletController.getMyEntries);

export default router;


