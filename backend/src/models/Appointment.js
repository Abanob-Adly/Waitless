import mongoose from 'mongoose';
const { Schema } = mongoose;

const APPOINTMENT_STATUSES = [
  'booked', 'called', 'held', 'skipped', 'in_progress',
  'completed', 'cancelled', 'no_show',
];
const APPOINTMENT_SOURCES = ['walk_in', 'marketplace', 'override'];

const appointmentSchema = new Schema({
  // ── Anchors ──
  session:        { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  patientProfile: { type: Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },

  // ── Denormalized for fast multi-tenant queries ──
  organization:     { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branch:           { type: Schema.Types.ObjectId, ref: 'Branch',       required: true, index: true },
  doctorMembership: { type: Schema.Types.ObjectId, ref: 'Membership',   required: true, index: true },

  // ── Queue ──
  queueNumber: { type: Number, required: true, min: 1 },

  // ── Lifecycle ──
  status: {
    type: String,
    enum: APPOINTMENT_STATUSES,
    default: 'booked',
    index: true,
  },
  source: { type: String, enum: APPOINTMENT_SOURCES, required: true },

  calledAt:             { type: Date, default: null },
  heldAt:               { type: Date, default: null },
  skippedAt:            { type: Date, default: null },  // for grace-list ordering
  checkedInAt:          { type: Date, default: null },
  consultationStartedAt:{ type: Date, default: null },  // set when status → in_progress
  completedAt:          { type: Date, default: null },
  cancelledAt:          { type: Date, default: null },
  cancelledReason:      { type: String, default: null },

  // ── Origin ──
  bookedBy: { type: Schema.Types.ObjectId, ref: 'Membership', default: null }, // walk-in only

  // ── Live queue page access (for walk-ins via WhatsApp link) ──
  accessToken: { type: String, default: null, index: true, sparse: true },

  // ── One-time review token (generated on completion, separate from accessToken) ──
  reviewToken: { type: String, default: null, index: true, sparse: true },

  // ── Appointment type — drives per-appointment duration in EWT calculation ──
  appointmentType: {
    type: String,
    enum: ['new_consultation', 'follow_up', 'medical_rep'],
    default: 'new_consultation',
  },

  // ── Payment ──
  paymentMethod: { type: String, enum: ['card', 'vodafone_cash', 'clinic', 'wallet', 'cash'], default: null },
  paymentStatus: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  paidAt:        { type: Date, default: null },
  receivedBy:    { type: Schema.Types.ObjectId, ref: 'Membership', default: null },
  paidAmount:    { type: Number, default: null },

  notes: { type: String },

  // ── Force-insert tracking ──────────────────────────────────────────────────
  emergencyReason:  { type: String, default: null },
  wasForceInserted: { type: Boolean, default: false },

  // Set when a session is closed while this appointment is still pending.
  // Shown as a persistent notice on the patient dashboard.
  sessionClosureNote: { type: String, default: null },
}, { timestamps: true });

// Hot query: today's queue ordering
appointmentSchema.index({ session: 1, queueNumber: 1 });
// Hot query: skipped patients to re-call
appointmentSchema.index({ session: 1, status: 1, skippedAt: 1 });
// Patient bookings list (via patientProfile)
appointmentSchema.index({ patientProfile: 1, createdAt: -1 });
// Prevent double-booking same session
appointmentSchema.index(
  { session: 1, patientProfile: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['booked', 'called', 'held', 'skipped', 'in_progress'] } }
  }
);

export default mongoose.model('Appointment', appointmentSchema);