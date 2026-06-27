import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { appointmentController, appointmentSchemas } from '../controllers/appointmentController.js';
import Appointment from '../models/Appointment.js';

const router = Router({ mergeParams: true });

const loadAppointment = (req) =>
  Appointment.findOne({ _id: req.params.appointmentId, session: req.params.sessionId });

router.post(
  '/',
  authenticate,
  authorize('appointment.book_walkin'),
  validate(appointmentSchemas.bookWalkIn),
  appointmentController.book
);

router.get(
  '/',
  authenticate,
  authorize('appointment.list'),
  appointmentController.list
);

router.get(
  '/:appointmentId',
  authenticate,
  authorize('appointment.view', loadAppointment),
  appointmentController.get
);

router.delete(
  '/:appointmentId',
  authenticate,
  authorize('appointment.cancel', loadAppointment),
  validate(appointmentSchemas.cancel),
  appointmentController.cancel
);

router.post(
  '/override',
  authenticate,
  authorize('appointment.book_walkin'),
  validate(appointmentSchemas.bookOverride),
  appointmentController.bookOverride
);

export default router;
