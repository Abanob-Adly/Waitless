import mongoose from 'mongoose';
const { Schema } = mongoose;

const patientProfileSchema = new Schema(
    {
        // null when it's a walk-in profile created by receptionist
        accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },

        fullName:  { type: String, required: true, trim: true },
        phone: {
            type: String,
            required: true,
            trim: true,
            match: [/^\+?[1-9]\d{7,14}$/, 'Please use a valid E.164 phone number'],
        },
        gender:    { type: String, enum: ['male', 'female'] },
        dateOfBirth: { type: Date },
        avatarUrl: { type: String, default: null },

        // Which org/branch registered this walk-in (for analytics/ownership of walk-ins)
        organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
        branchId:       { type: Schema.Types.ObjectId, ref: 'Branch' },
    }, 
    { timestamps: true }
);

// Fast walk-in lookup inside organization.
patientProfileSchema.index(
  { organizationId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { organizationId: { $type: 'objectId' } } });
// marketplace patient lookup
patientProfileSchema.index({ accountId: 1 }, { unique: true, partialFilterExpression: { accountId: { $type: "objectId" } } });

export default mongoose.model('PatientProfile', patientProfileSchema);