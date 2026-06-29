import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { walletController } from '../controllers/walletController.js';

const router = Router();

// Personal wallet (patient and staff/doctor)
router.get  ('/me',          authenticate, walletController.getMyWallet);
router.post ('/me/topup',    authenticate, walletController.topUp);
router.get  ('/me/entries',  authenticate, walletController.getMyEntries);

export default router;
