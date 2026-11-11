const { Schema, model } = require('mongoose');

const categorySchema = new Schema({
  name: { type: String, required: true, trim: true, unique: true, maxlength: 60 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, trim: true, maxlength: 300 },
}, { timestamps: true });

module.exports = model('Category', categorySchema);
