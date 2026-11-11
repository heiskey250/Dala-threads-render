const { Schema, model } = require('mongoose');

const cartSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [{
    _id: false,
    product:  { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1, max: 99 },
  }],
}, { timestamps: true });

module.exports = model('Cart', cartSchema);
