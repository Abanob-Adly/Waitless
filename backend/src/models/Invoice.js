import mongoose from 'mongoose';
const { Schema } = mongoose;

// Auto-generate sequential invoice number: INV-YYYY-NNNN
async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const last = await mongoose.model('Invoice').findOne(
    { invoiceNumber: { $regex: `^${prefix}` } },
    { invoiceNumber: 1 },
  ).sort({ invoiceNumber: -1 }).lean();

  let seq = 1;
  if (last?.invoiceNumber) {
    const parts = last.invoiceNumber.split('-');
    seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

const invoiceSchema = new Schema({
  invoiceNumber:       { type: String, unique: true, sparse: true },
  organization:        { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  plan:                { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
  planName:            { type: String, required: true },
  amount:              { type: Number, required: true, min: 0 },
  currency:            { type: String, default: 'EGP' },
  paymentMethod:       { type: String, enum: ['wallet', 'card', 'manual'], default: 'manual' },
  paymobTransactionId: { type: String, default: null },
  status:              { type: String, enum: ['paid', 'failed', 'refunded'], default: 'paid' },
  periodStart:         { type: Date, required: true },
  periodEnd:           { type: Date, required: true },
}, { timestamps: true });

invoiceSchema.pre('save', async function () {
  if (!this.invoiceNumber) {
    this.invoiceNumber = await generateInvoiceNumber();
  }
});

// Also handle insertMany / create paths that bypass pre-save
invoiceSchema.pre('insertMany', async function (docs) {
  for (const doc of docs) {
    if (!doc.invoiceNumber) {
      doc.invoiceNumber = await generateInvoiceNumber();
    }
  }
});

export default mongoose.model('Invoice', invoiceSchema);
