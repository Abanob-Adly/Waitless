import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { sessionController, sessionSchemas } from '../controllers/sessionController.js';
import { queueController, queueSchemas } from '../controllers/queueController.js';
import Session from '../models/QueueSession.js';
import appointmentRoutes from './appointmentRoutes.js';
import queueRoutes from './queueRoutes.js';

const router = Router({ mergeParams: true });

const loadSession = (req) =>
  Session.findOne({ _id: req.params.sessionId, branch: req.params.branchId });

router.post(
  '/generate',
  authenticate,
  authorize('session.generate'),
  validate(sessionSchemas.generate),
  sessionController.generate
);

router.get(
  '/',
  authenticate,
  authorize('session.view'),
  sessionController.list
);

router.get(
  '/:sessionId',
  authenticate,
  authorize('session.view', loadSession),
  sessionController.get
);

router.patch(
  '/:sessionId',
  authenticate,
  authorize('session.operate', loadSession),
  validate(sessionSchemas.patch),
  sessionController.patch
);

router.post(
  '/:sessionId/start',
  authenticate,
  authorize('session.operate', loadSession),
  sessionController.start
);

router.post(
  '/:sessionId/end',
  authenticate,
  authorize('session.operate', loadSession),
  sessionController.end
);

router.patch(
  '/:sessionId/delay',
  authenticate,
  authorize('queue.operate', loadSession),
  validate(queueSchemas.updateDelay),
  queueController.updateDelay
);

router.post(
  '/:sessionId/break',
  authenticate,
  authorize('queue.operate', loadSession),
  validate(queueSchemas.startBreak),
  queueController.startBreak
);

router.post(
  '/:sessionId/resume',
  authenticate,
  authorize('queue.operate', loadSession),
  queueController.resumeFromBreak
);

router.get(
  '/:sessionId/cash-summary',
  authenticate,
  authorize('queue.operate', loadSession),
  queueController.cashSummary
);

// Nested resources
router.use('/:sessionId/appointments', appointmentRoutes);
router.use('/:sessionId/queue', queueRoutes);

export default router;
