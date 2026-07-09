import { z } from 'zod';
import { sessionNoteService } from '../services/sessionNoteService.js';

const noteText = z.string().max(4000).optional();

export const sessionNoteSchemas = {
  upsert: z.object({
    chiefComplaint:      noteText,
    diagnosis:           noteText,
    prescription:        noteText,
    followUp:            noteText,
    generalNotes:        noteText,
    isSharedWithPatient: z.boolean().optional(),
  }),
};

export const sessionNoteController = {
  async getForAppointment(req, res) {
    const note = await sessionNoteService.getForAppointment({ appointment: req.resource });
    res.json({ data: note });
  },

  async upsertForAppointment(req, res) {
    // Attribute edits to the treating-doctor membership on the appointment,
    // not req.actor.activeMembership — for a dual-role account (admin +
    // doctor) activeMembership always resolves to the admin one (see
    // authenticate.js), even though the sessionNote.manage policy just
    // verified this account holds the specific doctor membership below.
    const note = await sessionNoteService.upsertForAppointment({
      appointment:       req.resource,
      actorMembershipId: req.resource.doctorMembership,
      data:              req.body,
    });
    res.json({ data: note });
  },

  async getForPatient(req, res) {
    const notes = await sessionNoteService.getForPatient({
      patientProfileId: req.params.profileId,
      actorMembership:  req.actor.activeMembership,
    });
    res.json({ data: notes });
  },

  async getMySharedNotes(req, res) {
    const notes = await sessionNoteService.getSharedForPatientAccount({
      accountId: req.actor.account._id,
    });
    res.json({ data: notes });
  },
};
