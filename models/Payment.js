const { Schema, model } = require('mongoose');

const paymentSchema = new Schema({
  order:  { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  user:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  method: { type: String, enum: ['momo-ussd', 'whatsapp', 'cash-on-delivery', 'bank-transfer'], required: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'RWF' },
  status: { type: String, enum: ['pending', 'confirmed', 'failed', 'refunded'], default: 'pending', index: true },
  reference: { type: String, trim: true, maxlength: 80 },     // MoMo transaction ID the customer received
  note: { type: String, trim: true, maxlength: 300 },
  confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: Date,
}, { timestamps: true });

paymentSchema.set('toJSON', { transform: (_d, r) => { delete r.__v; return r; } });

module.exports = model('Payment', paymentSchema);
