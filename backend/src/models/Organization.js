import mongoose from 'mongoose';
const { Schema } = mongoose;

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    type: { type: String, enum: ['clinic', 'hospital'], required: true },

    // Branding (used in dashboard + marketplace)
    description: { type: String, maxlength: 2000 },
    logoUrl:     { type: String },
    coverUrl:    { type: String },

    contact: {
      email:   { type: String, lowercase: true, trim: true },
      phone:   { type: String, trim: true },
      website: { type: String, trim: true },
    },

    // single marketplace switch
    isPublic: { type: Boolean, default: false, index: true },

    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

organizationSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'deleted' } } }
);

// Marketplace listing query
organizationSchema.index({ isPublic: 1, status: 1 });
// Marketplace text search
organizationSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Organization', organizationSchema);