import mongoose from 'mongoose';
const { Schema } = mongoose;

const walletSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
    balance:      { type: Number, default: 0, min: 0 },
    currency:     { type: String, default: 'EGP' },
    status:       { type: String, enum: ['active', 'frozen', 'closed'], default: 'active' },
  },
  { timestamps: true },
);

export default mongoose.model('Wallet', walletSchema);