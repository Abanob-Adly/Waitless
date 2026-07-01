import mongoose from 'mongoose';
const { Schema } = mongoose;

const scheduleSlotSchema = new Schema({
  dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0=Sun, 6=Sat (JS Date.getDay)
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, // "17:00"
  endTime:   { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
}, { _id: false });

const doctorBranchScheduleSchema = new Schema({
  doctorMembership: { type: Schema.Types.ObjectId, ref: 'Membership',   required: true, index: true },
  organization:     { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branch:           { type: Schema.Types.ObjectId, ref: 'Branch',       required: true, index: true },

  schedule: { type: [scheduleSlotSchema], default: [] },

  avgConsultationMin: { type: Number, min: 1, default: null },
  defaultMaxBookings: { type: Number, min: 1, default: null },
  consultationFee: {
    amount:   { type: Number, min: 0 },
    currency: { type: String, default: 'EGP' },
  },

  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    index: true,
  },
}, { timestamps: true });

// One active schedule per doctor+branch
doctorBranchScheduleSchema.index(
  { doctorMembership: 1, branch: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

export default mongoose.model('DoctorBranchSchedule', doctorBranchScheduleSchema);