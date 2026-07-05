import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { paymobController } from '../controllers/paymobController.js';

const router = Router();

// Patient initiates a Paymob card payment for their appointment
router.post('/initiate', authenticate, paymobController.initiate);

// Paymob webhook — must be public (no auth). Raw body for HMAC verification.
router.post('/webhook', paymobController.webhook);

// Paymob iframe redirect callback — browser lands here after payment
router.get('/callback', paymobController.callback);

export default router;
