import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    appointment:      { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    doctorMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership',  required: true },
    reviewToken:      { type: String, required: true, unique: true }, // equals appointment.accessToken
    rating:           { type: Number, required: true, min: 1, max: 5 },
    comment:          { type: String, maxlength: 300 },
  },
  { timestamps: true },
);

export default mongoose.model('Review', reviewSchema);
