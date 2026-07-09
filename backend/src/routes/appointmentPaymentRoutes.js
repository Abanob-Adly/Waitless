import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { paymentController } from '../controllers/paymentController.js';

const router = Router();

// POST /appointments/:appointmentId/pay — patient pays for a booked appointment via Paymob
router.post('/:appointmentId/pay', authenticate, paymentController.appointmentCheckout);

// GET /appointments/payments/result?paymentId=... — poll after Paymob redirect
router.get('/payments/result', authenticate, paymentController.result);

export default router;