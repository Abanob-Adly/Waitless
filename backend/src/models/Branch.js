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

  // GeoJSON for "find clinics near me"
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },

  phone:    { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

branchSchema.index({ location: '2dsphere' });
branchSchema.index({ organization: 1, isActive: 1 });

export default mongoose.model('Branch', branchSchema);