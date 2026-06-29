import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { queueController, queueSchemas } from '../controllers/queueController.js';
import Session from '../models/QueueSession.js';

const router = Router({ mergeParams: true });

const loadSession = (req) =>
  Session.findOne({ _id: req.params.sessionId, branch: req.params.branchId });

router.get(
  '/',
  authenticate,
  authorize('queue.view', loadSession),
  queueController.getStatus
);

router.post(
  '/call-next',
  authenticate,
  authorize('queue.operate', loadSession),
  queueController.callNext
);

router.patch(
  '/appointments/:appointmentId/status',
  authenticate,
  authorize('queue.operate', loadSession),
  validate(queueSchemas.updateStatus),
  queueController.updateStatus
);

router.post(
  '/appointments/:appointmentId/hold',
  authenticate,
  authorize('queue.operate', loadSession),
  queueController.hold
);

router.post(
  '/appointments/:appointmentId/reinsert',
  authenticate,
  authorize('queue.operate', loadSession),
  queueController.reinsert
);

router.post(
  '/appointments/:appointmentId/force-insert',
  authenticate,
  authorize('queue.operate', loadSession),
  queueController.forceInsert
);

export default router;
