import mongoose from 'mongoose';
const { Schema } = mongoose;

// A snapshot of the editable content fields taken right before an overwrite,
// so a doctor can see what a note used to say — clinical documentation should
// never silently disappear on edit.
const editHistoryEntrySchema = new Schema({
  editedAt:  { type: Date, default: Date.now },
  editedBy:  { type: Schema.Types.ObjectId, ref: 'Membership', required: true },
  snapshot: {
    chiefComplaint: { type: String, default: '' },
    diagnosis:      { type: String, default: '' },
    prescription:   { type: String, default: '' },
    followUp:       { type: String, default: '' },
    generalNotes:   { type: String, default: '' },
  },
}, { _id: false });

const sessionNoteSchema = new Schema({
  // One note document per patient visit — a doctor's daily queue "Session"
  // covers many different patients, so notes anchor to the individual
  // Appointment (the per-visit unit), not the QueueSession.
  appointment:      { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true, index: true },
  doctorMembership: { type: Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
  patientProfile:   { type: Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },
  organization:     { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

  chiefComplaint: { type: String, default: '', maxlength: 2000 },
  diagnosis:      { type: String, default: '', maxlength: 2000 },
  prescription:   { type: String, default: '', maxlength: 2000 },
  followUp:       { type: String, default: '', maxlength: 2000 },
  generalNotes:   { type: String, default: '', maxlength: 4000 },

  isSharedWithPatient: { type: Boolean, default: false },
  editHistory:         { type: [editHistoryEntrySchema], default: [] },
}, { timestamps: true });

export default mongoose.model('SessionNote', sessionNoteSchema);
