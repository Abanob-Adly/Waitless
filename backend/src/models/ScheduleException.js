// models/scheduleException.model.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const EXCEPTION_REASONS = ['sick', 'leave', 'emergency', 'other'];

const scheduleExceptionSchema = new Schema({
  doctorBranchSchedule: {
    type: Schema.Types.ObjectId,
    ref: 'DoctorBranchSchedule',
    required: true,
    index: true,
  },

  // Calendar date in the org's timezone — stored as a Date at 00:00 UTC.
  // Compare using $gte / $lt of day boundaries; never compare time-of-day.
  date: { type: Date, required: true },

  reason: { type: String, enum: EXCEPTION_REASONS, default: 'other' },
  note:   { type: String, maxlength: 500 },

  createdBy: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
}, { timestamps: true });

// One exception per (schedule, date) — prevents duplicates from double-clicks.
scheduleExceptionSchema.index(
  { doctorBranchSchedule: 1, date: 1 },
  { unique: true }
);

// Lookup by date range for the generation job ("any exceptions in next 14 days?")
scheduleExceptionSchema.index({ date: 1 });

export default mongoose.model('ScheduleException', scheduleExceptionSchema);