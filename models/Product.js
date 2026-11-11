const { Schema, model } = require('mongoose');

const productSchema = new Schema({
  number:      { type: Number, unique: true, sparse: true },      // 1 = bag1.jpg on the website
  name:        { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1500, default: '' },
  price:       { type: Number, required: true, min: 0 },          // FRW
  category:    { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  badge:       { type: String, trim: true, maxlength: 30, default: '' },  // New, Popular, Bridal...
  image:       { type: String, trim: true, default: '' },         // "bag7.jpg" or "/uploads/xyz.jpg"
  stock:       { type: Number, required: true, min: 0, default: 0 },
  lowStockThreshold: { type: Number, min: 0, default: 3 },
  sold:        { type: Number, min: 0, default: 0 },
  featured:    { type: Boolean, default: false },
  active:      { type: Boolean, default: true },
}, { timestamps: true });

productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });

productSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => { delete ret.__v; delete ret.id; return ret; },
});
productSchema.virtual('lowStock').get(function () { return this.stock <= this.lowStockThreshold; });

module.exports = model('Product', productSchema);
