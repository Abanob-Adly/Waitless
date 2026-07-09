import Router from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { authController, schemas } from '../controllers/authController.js';
import { joinRequestController } from '../controllers/joinRequestController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Stricter than the generic /auth limiter (20/15min) — password reset is a
// higher-value target for abuse (email bombing, token brute-forcing).
// Keyed by IP+email when an email is present in the body (request step) so
// one IP can't exhaust the limit for a specific victim while still allowing
// a shared IP (office/clinic network) to reset different accounts; falls
// back to IP-only for the confirm step, which has no email in its body.
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ipKey = ipKeyGenerator(req.ip);
    return req.body?.email ? `${ipKey}:${req.body.email}` : ipKey;
  },
  message: { status: 'error', message: 'Too many password reset attempts. Please try again later.' },
});

// Public
router.get ('/check-availability', authController.checkAvailability);
router.post('/user/register',    validate(schemas.register), authController.registerPatient);
router.post('/worker/register',  validate(schemas.register), authController.registerWorker);
router.post('/user/login',       validate(schemas.login),    authController.loginPatient);
router.post('/worker/login',     validate(schemas.login),    authController.loginWorker);
// router.post('/login',        validate(schemas.login),    authController.login);
router.post('/refresh',         validate(schemas.refresh),  authController.refresh);
router.post('/logout',          authController.logout);

router.post('/password-reset/request', passwordResetLimiter, validate(schemas.requestReset), authController.requestPasswordReset);
router.post('/password-reset/confirm', passwordResetLimiter, validate(schemas.confirmReset), authController.confirmPasswordReset);

// Authenticated
router.get ('/me',                   authenticate, authController.me);
router.get ('/me/join-requests',     authenticate, joinRequestController.listMine);
router.post('/email/verify',         authenticate, validate(schemas.verifyEmail), authController.confirmEmailVerification);
router.post('/phone/verify/request', authenticate, authController.requestPhoneVerification);
router.post('/phone/verify/confirm', authenticate, validate(schemas.verifyPhone), authController.confirmPhoneVerification);

export default router;