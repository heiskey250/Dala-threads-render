const { Schema, model } = require('mongoose');

const messageSchema = new Schema({
  name:    { type: String, required: true, trim: true, maxlength: 100 },
  email:   { type: String, required: true, lowercase: true, trim: true },
  phone:   { type: String, trim: true, maxlength: 30 },
  subject: { type: String, enum: ['order', 'question', 'wholesale', 'other'], default: 'question' },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  user:    { type: Schema.Types.ObjectId, ref: 'User' },     // set when the sender was signed in
  status:  { type: String, enum: ['new', 'read', 'replied'], default: 'new', index: true },
  reply: {
    text: String,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    at: Date,
  },
}, { timestamps: true });

messageSchema.set('toJSON', { transform: (_d, r) => { delete r.__v; return r; } });

module.exports = model('Message', messageSchema);
