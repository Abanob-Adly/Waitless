import mongoose from 'mongoose';
const { Schema, Types } = mongoose;

/**
 * One concrete instance of a doctor's shift:
 *   "Dr. Ahmed @ Maadi Branch, 2026-06-22, 17:00–22:00"
 *
 * Generated from DoctorBranchSchedule. Holds the live queue state.
 */
const sessionSchema = new Schema(
  {
    doctorBranchSchedule: {
      type: Types.ObjectId,
      ref: 'DoctorBranchSchedule',
      required: true,
    },
    branch: { type: Types.ObjectId, ref: 'Branch',     required: true, index: true },
    doctor: { type: Types.ObjectId, ref: 'Membership', required: true, index: true },

    startTime: { type: Date, required: true, index: true },
    endTime:   { type: Date, required: true },

    avgConsultationMin: { type: Number, min: 1, required: true },

    status: {
      type: String,
      enum: ['scheduled', 'active', 'ended', 'cancelled'],
      default: 'scheduled',
      index: true,
    },

    // Monotonic counter — used to atomically assign queueNumbers via $inc.
    bookingsCount:  { type: Number, default: 0, min: 0 },
    // The queueNumber currently being served (0 = nobody yet).
    currentServing: { type: Number, default: 0, min: 0 },
    // Fixed extra delay added by receptionist (doctor running late). Added to all ETAs.
    globalDelayMin: { type: Number, default: 0, min: 0 },
    // Maximum bookings allowed. null = unlimited.
    maxBookings:    { type: Number, default: null, min: 1 },

    // ── Break tracking ───────────────────────────────────────────────────────
    isOnBreak: { type: Boolean, default: false },
    breaks: [{
      startedAt:   { type: Date, required: true },
      endedAt:     { type: Date, default: null },
      durationMin: { type: Number, default: null },
      reason:      { type: String, default: null },
      _id:         false,
    }],

    // ── Late-start tracking ──────────────────────────────────────────────────
    actualStartTime: { type: Date, default: null },
    lateStartMin:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One session per (schedule, day) — prevents duplicate generation.
sessionSchema.index(
  { doctorBranchSchedule: 1, startTime: 1 },
  { unique: true }
);

/**
 * Atomically reserves the next queue number for a new booking.
 * Returns the updated Session (use .bookingsCount as the new queueNumber),
 * or null if the session can't accept bookings.
 */
sessionSchema.statics.reserveQueueNumber = function (sessionId) {
  return this.findOneAndUpdate(
    {
      _id: sessionId,
      status: { $in: ['scheduled', 'active'] },
      // Only allow booking when under the limit (null maxBookings = unlimited)
      $or: [
        { maxBookings: null },
        { $expr: { $lt: ['$bookingsCount', '$maxBookings'] } },
      ],
    },
    { $inc: { bookingsCount: 1 } },
    { new: true }
  );
};

export default mongoose.model('Session', sessionSchema);