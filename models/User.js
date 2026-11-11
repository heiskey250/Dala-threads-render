const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 60 },
  lastName:  { type: String, required: true, trim: true, maxlength: 60 },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:     { type: String, trim: true, maxlength: 30 },
  address:   { type: String, trim: true, maxlength: 200 },
  city:      { type: String, trim: true, maxlength: 80 },
  password:  { type: String, required: true, minlength: 8, select: false },
  role:      { type: String, enum: ['customer', 'admin'], default: 'customer' },
  isActive:  { type: Boolean, default: true },
  lastLoginAt: Date,
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => { delete ret.password; delete ret.__v; return ret; },
});

module.exports = model('User', userSchema);
