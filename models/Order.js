const { Schema, model } = require('mongoose');

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

const orderSchema = new Schema({
  orderNumber: { type: String, required: true, unique: true },
  user:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: [{
    _id: false,
    product:  { type: Schema.Types.ObjectId, ref: 'Product' },
    number:   Number,
    name:     { type: String, required: true },   // snapshot: stays correct if the product is edited later
    price:    { type: Number, required: true },
    image:    String,
    quantity: { type: Number, required: true, min: 1 },
  }],
  subtotal:    { type: Number, required: true },
  shippingFee: { type: Number, default: 0 },
  total:       { type: Number, required: true },
  shippingAddress: {
    fullName: { type: String, required: true, trim: true },
    phone:    { type: String, trim: true },
    address:  { type: String, required: true, trim: true },
    city:     { type: String, trim: true },
    notes:    { type: String, trim: true, maxlength: 300 },
  },
  status: { type: String, enum: STATUSES, default: 'pending', index: true },
  statusHistory: [{
    _id: false,
    status: String,
    note: String,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  }],
  paymentMethod: { type: String, enum: ['momo-ussd', 'whatsapp', 'cash-on-delivery', 'bank-transfer'], default: 'momo-ussd' },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'failed', 'refunded'], default: 'unpaid', index: true },
  payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
}, { timestamps: true });

orderSchema.statics.STATUSES = STATUSES;
orderSchema.set('toJSON', { transform: (_d, r) => { delete r.__v; return r; } });

module.exports = model('Order', orderSchema);
