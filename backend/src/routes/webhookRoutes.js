import { Router } from 'express';
import { paymentController } from '../controllers/paymentController.js';

const router = Router();

// Public endpoint — Paymob POSTs here after payment.
// Auth = HMAC verification inside the controller.
router.post('/paymob', paymentController.paymobWebhook);

export default router;