import mongoose from 'mongoose';
const { Schema } = mongoose;

const transactionSchema = new Schema({
  org:            { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branch:         { type: Schema.Types.ObjectId, ref: 'Branch',       required: true },
  appointment:    { type: Schema.Types.ObjectId, ref: 'Appointment',  required: true, unique: true },
  session:        { type: Schema.Types.ObjectId, ref: 'Session' },
  patientName:    { type: String, default: '' },
  grossAmount:    { type: Number, required: true },
  currency:       { type: String, default: 'EGP' },
  platformCutPct: { type: Number, required: true },
  platformCut:    { type: Number, required: true },
  orgNet:         { type: Number, required: true },
  status:         { type: String, enum: ['settled', 'pending', 'refunded'], default: 'settled' },
}, { timestamps: true });

transactionSchema.index({ org: 1, createdAt: -1 });
transactionSchema.index({ org: 1, branch: 1, createdAt: -1 });
transactionSchema.index({ org: 1, status: 1 });

export default mongoose.model('Transaction', transactionSchema);
