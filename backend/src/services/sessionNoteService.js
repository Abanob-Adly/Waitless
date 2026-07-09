import SessionNote from '../models/SessionNote.js';

const CONTENT_FIELDS = ['chiefComplaint', 'diagnosis', 'prescription', 'followUp', 'generalNotes'];

export const sessionNoteService = {
  async getForAppointment({ appointment }) {
    return SessionNote.findOne({ appointment: appointment._id }).lean();
  },

  // Upsert — a doctor may save partial notes mid-visit and keep coming back
  // to the same appointment to add more, rather than being forced to create
  // once and never revise.
  async upsertForAppointment({ appointment, actorMembershipId, data }) {
    const existing = await SessionNote.findOne({ appointment: appointment._id });

    if (!existing) {
      return SessionNote.create({
        appointment:      appointment._id,
        doctorMembership: appointment.doctorMembership,
        patientProfile:   appointment.patientProfile,
        organization:      appointment.organization,
        ...Object.fromEntries(CONTENT_FIELDS.map((f) => [f, data[f] ?? ''])),
        isSharedWithPatient: data.isSharedWithPatient ?? false,
      });
    }

    // Snapshot the pre-edit content so it isn't silently lost on overwrite.
    existing.editHistory.push({
      editedBy: actorMembershipId,
      snapshot: Object.fromEntries(CONTENT_FIELDS.map((f) => [f, existing[f]])),
    });
    for (const f of CONTENT_FIELDS) {
      if (data[f] !== undefined) existing[f] = data[f];
    }
    if (data.isSharedWithPatient !== undefined) existing.isSharedWithPatient = data.isSharedWithPatient;
    await existing.save();
    return existing;
  },

  // A non-admin doctor only sees notes they personally authored — this route
  // spans every visit a patient has had, potentially with other doctors, and
  // clinical notes aren't shared between doctors without an explicit
  // "Share with Patient" (let alone share-with-colleague) mechanism.
  async getForPatient({ patientProfileId, actorMembership }) {
    const filter = { patientProfile: patientProfileId };
    if (actorMembership.kind !== 'admin') {
      filter.doctorMembership = actorMembership._id;
    }
    return SessionNote.find(filter)
      .populate({ path: 'appointment', select: 'session queueNumber status createdAt' })
      .sort({ createdAt: -1 })
      .lean();
  },
};

export { CONTENT_FIELDS };
