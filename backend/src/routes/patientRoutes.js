import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../policies/can.js';
import { validate } from '../middleware/validate.js';
import { patientController, patientSchemas } from '../controllers/patientController.js';
import { sessionNoteController } from '../controllers/sessionNoteController.js';
import PatientProfile from '../models/PatientProfile.js';

const router = Router({ mergeParams: true });

const loadProfile = (req) =>
  PatientProfile.findOne({ _id: req.params.profileId, organizationId: req.params.orgId });

router.post(
  '/',
  authenticate,
  authorize('patient.create'),
  validate(patientSchemas.create),
  patientController.create
);

router.get(
  '/',
  authenticate,
  authorize('patient.list'),
  patientController.list
);

router.get(
  '/:profileId',
  authenticate,
  authorize('patient.view', loadProfile),
  patientController.get
);

router.put(
  '/:profileId',
  authenticate,
  authorize('patient.update', loadProfile),
  validate(patientSchemas.update),
  patientController.update
);

router.get(
  '/:profileId/history',
  authenticate,
  authorize('patient.view', loadProfile),
  patientController.getHistory
);

router.get(
  '/:profileId/notes',
  authenticate,
  authorize('sessionNote.viewPatientHistory', loadProfile),
  sessionNoteController.getForPatient
);

export default router;
