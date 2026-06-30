import Router from 'express';
import { authController, schemas } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Public
router.post('/user/register', validate(schemas.register), authController.registerPatient);
router.post('/worker/register', validate(schemas.register), authController.registerWorker);
router.post('/user/login',      validate(schemas.login),    authController.loginPatient);
router.post('/worker/login',    validate(schemas.login),    authController.loginWorker);
// router.post('/login',        validate(schemas.login),    authController.login);
router.post('/refresh',         validate(schemas.refresh),  authController.refresh);
router.post('/logout',          authController.logout);

router.post('/password-reset/request', validate(schemas.requestReset), authController.requestPasswordReset);
router.post('/password-reset/confirm', validate(schemas.confirmReset), authController.confirmPasswordReset);

// Authenticated
router.get ('/me',                   authenticate, authController.me);
router.post('/email/verify/request', authenticate, authController.requestEmailVerification);
router.post('/email/verify/confirm', validate(schemas.verifyEmail), authenticate, authController.confirmEmailVerification);
router.post('/phone/verify/request', validate(schemas.verifyPhone), authenticate, authController.requestPhoneVerification);
router.post('/phone/verify/confirm', authenticate, authController.confirmPhoneVerification);

export default router;