const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  firstName:  { type: String, required: true, trim: true },
  lastName:   { type: String, required: true, trim: true },
  email:      {
    type: String, required: true, unique: true, lowercase: true,
    validate: [validator.isEmail, 'Invalid email address'],
  },
  phone:      { type: String, trim: true },
  password:   { type: String, required: true, minlength: 8, select: false },
  role:       { type: String, enum: ['buyer', 'seller'], default: 'buyer' },
  avatar:     { type: String, default: '' },
  location:   { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  wishlist:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  createdAt:  { type: Date, default: Date.now },
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

// Virtual full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('User', userSchema);