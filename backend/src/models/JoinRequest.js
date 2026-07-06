import mongoose from 'mongoose';
const { Schema } = mongoose;

const joinRequestSchema = new Schema({
  account: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true,
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'withdrawn'],
    default: 'pending',
    index: true,
  },
  // Doctor profile info supplied at request time
  specialties:    [{ type: String, lowercase: true, trim: true }],
  bio:            { type: String, maxlength: 2000 },
  licenseNumber:  { type: String, trim: true },
  message:        { type: String, maxlength: 500 }, // optional note from doctor

  // Resolution
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

// One pending request per doctor per org
joinRequestSchema.index(
  { account: 1, organization: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  },
);

joinRequestSchema.index({ organization: 1, status: 1 });
joinRequestSchema.index({ account: 1, createdAt: -1 });

export default mongoose.model('JoinRequest', joinRequestSchema);
