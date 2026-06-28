import Router from 'express';
import { authController, schemas } from '../controllers/authController.js';
import { joinRequestController } from '../controllers/joinRequestController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Public
router.post('/user/register',    validate(schemas.register), authController.registerPatient);
router.post('/worker/register',  validate(schemas.register), authController.registerWorker);
router.post('/user/login',       validate(schemas.login),    authController.loginPatient);
router.post('/worker/login',     validate(schemas.login),    authController.loginWorker);
// router.post('/login',        validate(schemas.login),    authController.login);
router.post('/refresh',         validate(schemas.refresh),  authController.refresh);
router.post('/logout',          authController.logout);

router.post('/password-reset/request', validate(schemas.requestReset), authController.requestPasswordReset);
router.post('/password-reset/confirm', validate(schemas.confirmReset), authController.confirmPasswordReset);

// Authenticated
router.get ('/me',                   authenticate, authController.me);
router.get ('/me/join-requests',     authenticate, joinRequestController.listMine);
router.post('/email/verify',         authenticate, validate(schemas.verifyEmail), authController.confirmEmailVerification);
router.post('/phone/verify/request', authenticate, authController.requestPhoneVerification);
router.post('/phone/verify/confirm', authenticate, validate(schemas.verifyPhone), authController.confirmPhoneVerification);

export default router;