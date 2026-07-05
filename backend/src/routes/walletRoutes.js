import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { walletController } from '../controllers/walletController.js';

const router = Router();

// Personal wallet (patient and staff/doctor)
router.get  ('/me',           authenticate, walletController.getMyWallet);
router.post ('/me/topup',     authenticate, walletController.topUp);
router.post ('/me/purchase',  authenticate, walletController.purchaseAtBooking);
router.post ('/me/withdraw',  authenticate, walletController.requestWithdrawal);
router.get  ('/me/entries',   authenticate, walletController.getMyEntries);

export default router;
