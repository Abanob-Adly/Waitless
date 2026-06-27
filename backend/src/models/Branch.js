import mongoose from 'mongoose';
const { Schema } = mongoose;

const branchSchema = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name:         { type: String, required: true, trim: true },

  // Address embedded — always queried together with branch
  address: {
    street:        String,
    city:          String,
    Governorate:   String,
    country:       String,
    zip:           String,
  },

  // GeoJSON for "find clinics near me" — omit entirely when not provided.
  // default: undefined prevents Mongoose from creating location: { coordinates: [] }
  // which would fail the 2dsphere index even with sparse: true.
  location: {
    type:        { type: String, enum: ['Point'] },
    coordinates: { type: [Number], default: undefined },
  },

  phone:    { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

branchSchema.index({ location: '2dsphere' }, { sparse: true });
branchSchema.index({ organization: 1, isActive: 1 });

export default mongoose.model('Branch', branchSchema);