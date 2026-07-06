import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { scheduleController, scheduleSchemas } from '../controllers/scheduleController.js';
import DoctorBranchSchedule from '../models/DoctorBranchSchedule.js';
import ScheduleException from '../models/ScheduleException.js';

const router = Router({ mergeParams: true });

const loadSchedule = (req) =>
  DoctorBranchSchedule.findOne({ _id: req.params.scheduleId, organization: req.params.orgId });

const loadException = (req) =>
  ScheduleException.findOne({
    _id: req.params.exceptionId,
    doctorBranchSchedule: req.params.scheduleId,
  });

router.post(
  '/',
  authenticate,
  authorize('schedule.manage'),
  validate(scheduleSchemas.create),
  scheduleController.create
);

router.get(
  '/',
  authenticate,
  authorize('schedule.view'),
  scheduleController.list
);

router.get(
  '/:scheduleId',
  authenticate,
  authorize('schedule.view', loadSchedule),
  scheduleController.get
);

router.put(
  '/:scheduleId',
  authenticate,
  authorize('schedule.manage', loadSchedule),
  validate(scheduleSchemas.update),
  scheduleController.update
);

router.delete(
  '/:scheduleId',
  authenticate,
  authorize('schedule.manage', loadSchedule),
  scheduleController.delete
);

router.post(
  '/:scheduleId/exceptions',
  authenticate,
  authorize('schedule.manage', loadSchedule),
  validate(scheduleSchemas.createException),
  scheduleController.createException
);

router.get(
  '/:scheduleId/exceptions',
  authenticate,
  authorize('schedule.view', loadSchedule),
  scheduleController.listExceptions
);

router.delete(
  '/:scheduleId/exceptions/:exceptionId',
  authenticate,
  authorize('schedule.manage', loadException),
  scheduleController.deleteException
);

export default router;
