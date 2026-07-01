import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { queueController, queueSchemas } from '../controllers/queueController.js';
import Session from '../models/QueueSession.js';
import Branch from '../models/Branch.js';

const router = Router({ mergeParams: true });

// Resolve the session only when its branch belongs to the org in the URL,
// preventing cross-org queue operation via a foreign sessionId + branchId.
const loadSession = async (req) => {
  const branch = await Branch.findOne({
    _id:          req.params.branchId,
    organization: req.params.orgId,
  }).select('_id');
  if (!branch) return null;
  return Session.findOne({ _id: req.params.sessionId, branch: branch._id });
};

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
