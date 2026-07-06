import mongoose from "mongoose";
const { Schema } = mongoose;

const baseOptions = {
  discriminatorKey: "kind", // 'admin' | 'doctor' | 'receptionist'
  collection: "memberships",
  timestamps: true,
};

const membershipSchema = new Schema(
  {
    account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
      index: true,
      required: function () {
        return ["active", "suspended", "revoked"].includes(this.status);
      },
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // 'pending' = invited but hasn't accepted yet
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "revoked"],
      default: "pending",
      index: true,
    },
    acceptedAt: { type: Date, default: null },

    // ── Invitation (merged in — no separate Invitation entity) ──
    invitedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    inviteToken: { type: String, default: null, index: true, sparse: true },
    inviteEmail: { type: String, lowercase: true, trim: true, default: null },
    inviteExpiresAt: { type: Date, default: null },

    // Tracks when the last role change was applied (via admin Edit).
    // Enforces a 30-day rate limit on role changes.
    lastRoleChangeAt: { type: Date, default: null },
  },
  baseOptions,
);

// Prevent duplicate accepted memberships.
// Pending invites have account=null, so they are excluded.
membershipSchema.index(
  { account: 1, organization: 1, kind: 1 },
  {
    unique: true,
    partialFilterExpression: {
      account: { $exists: true, $ne: null },
    },
  },
);

// Fast "list all doctors in org X" / "list active receptionists in org X"
membershipSchema.index({ organization: 1, kind: 1, status: 1 });

const Membership = mongoose.model("Membership", membershipSchema);

const AdminMembership = Membership.discriminator(
  "admin",
  new Schema({
    permissions: { type: [String], default: ["*"] },
    isSuper: { type: Boolean, default: false },
  }),
);

const DoctorMembership = Membership.discriminator(
  "doctor",
  new Schema({
    specialties: [{ type: String, lowercase: true, trim: true, index: true }],
    services: [{ type: String, lowercase: true, trim: true }],

    licenseNumber: { type: String, trim: true },
    bio: { type: String, maxlength: 2000 },
    yearsOfExperience: { type: Number, min: 0, default: null },
    languagesSpoken: [{ type: String, trim: true }],

    websiteUrl: { type: String, trim: true, default: null },
    avatarUrl: { type: String, trim: true, default: null },
    acceptedInsurances: [{ type: String, trim: true }],

    ratingStats: {
      avg: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },

    // Long-term adaptive consultation average (Feature B).
    // Seeded from the schedule's default; drifts slowly via α=0.1 smoothing
    // across sessions so new sessions start with a personalised baseline.
    historicalAvgConsultationMin: { type: Number, default: null },
  }),
);

const ReceptionistMembership = Membership.discriminator(
  "receptionist",
  new Schema({
    branches: {
      type: [{ type: Schema.Types.ObjectId, ref: "Branch" }],
      validate: [
        (arr) => Array.isArray(arr) && arr.length > 0,
        "Receptionist must be assigned to at least one branch",
      ],
      index: true,
    },
  }),
);

export {
  Membership,
  AdminMembership,
  DoctorMembership,
  ReceptionistMembership,
};
