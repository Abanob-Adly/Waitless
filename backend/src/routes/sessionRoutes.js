import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { sessionController, sessionSchemas } from '../controllers/sessionController.js';
import { queueController, queueSchemas } from '../controllers/queueController.js';
import Session from '../models/QueueSession.js';
import Branch from '../models/Branch.js';
import appointmentRoutes from './appointmentRoutes.js';
import queueRoutes from './queueRoutes.js';

const router = Router({ mergeParams: true });

// Resolve the session only when its branch belongs to the org in the URL.
// Without the org check, an actor authenticated under org A could operate a
// session in org B by supplying a foreign sessionId + branchId pair.
const loadSession = async (req) => {
  const branch = await Branch.findOne({
    _id:          req.params.branchId,
    organization: req.params.orgId,
  }).select('_id');
  if (!branch) return null;
  return Session.findOne({ _id: req.params.sessionId, branch: branch._id });
};

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

// Doctor submits a late-start excuse (before or after penalty fires)
router.post(
  '/:sessionId/excuse',
  authenticate,
  authorize('session.operate', loadSession),
  validate(sessionSchemas.submitExcuse),
  sessionController.submitExcuse
);

// Admin approves or denies a pending excuse
router.patch(
  '/:sessionId/excuse',
  authenticate,
  authorize('session.operate', loadSession),
  validate(sessionSchemas.reviewExcuse),
  sessionController.reviewExcuse
);

// Nested resources
router.use('/:sessionId/appointments', appointmentRoutes);
router.use('/:sessionId/queue', queueRoutes);

export default router;
