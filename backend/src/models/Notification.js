// models/notification.model.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const NOTIFICATION_CHANNELS = ['whatsapp']; // 'sms', 'email' added later
const NOTIFICATION_STATUSES = ['queued', 'sent', 'delivered', 'failed'];

const NOTIFICATION_TEMPLATES = [
  'queue_position_update', // "3 patients ahead of you (~45 min)"
  'queue_almost_up',       // "You're next — head to clinic"
  'queue_your_turn',       // "It's your turn. Check in within 5 min."
  'appointment_cancelled', // "Your appointment was cancelled. Reason: ..."
  'session_cancelled',     // "Dr. X's session on <date> was cancelled."
];

const notificationSchema = new Schema({
  channel:   { type: String, enum: NOTIFICATION_CHANNELS, default: 'whatsapp' },
  toPhone:   { type: String, required: true, trim: true }, // E.164, snapshotted

  template:  { type: String, enum: NOTIFICATION_TEMPLATES, required: true },
  variables: { type: Schema.Types.Mixed, default: {} }, // { name, queueNumber, eta, link, ... }

  appointment:    { type: Schema.Types.ObjectId, ref: 'Appointment', default: null, index: true },
  session:        { type: Schema.Types.ObjectId, ref: 'Session',     default: null, index: true },
  patientProfile: { type: Schema.Types.ObjectId, ref: 'PatientProfile', default: null },

  status: {
    type: String,
    enum: NOTIFICATION_STATUSES,
    default: 'queued',
    index: true,
  },
  sentAt:      { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  failedAt:    { type: Date, default: null },
  error:       { type: String, default: null },

  providerMessageId: { type: String, default: null }, // for webhook delivery updates
  attempts:          { type: Number, default: 0, min: 0 },
}, { timestamps: true });

// Worker query: "give me queued/failed messages to retry"
notificationSchema.index({ status: 1, createdAt: 1 });

// Webhook lookup: provider sends delivery callbacks by their message ID
notificationSchema.index(
  { providerMessageId: 1 },
  { unique: true, partialFilterExpression: { providerMessageId: { $type: 'string' } } }
);

// Throttling: prevent duplicate template sends to same appointment within X minutes
// (Enforced in code, but this index makes the lookup cheap.)
notificationSchema.index({ appointment: 1, template: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);