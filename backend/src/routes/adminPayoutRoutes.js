import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { payoutController } from '../controllers/payoutController.js';

const router = Router();

router.get('/payouts', authenticate, authorize('payouts.manage'), payoutController.listAllPayouts);
router.patch('/payouts/:payoutId', authenticate, authorize('payouts.manage'), payoutController.processPayout);

export default router;