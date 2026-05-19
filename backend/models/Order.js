const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  buyer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

  orderType: { type: String, enum: ['purchase', 'rental'], required: true },

  // Rental-specific
  rentalDays:    { type: Number },
  rentalStart:   { type: Date },
  rentalEnd:     { type: Date },
  depositAmount: { type: Number },
  depositReturned: { type: Boolean, default: false },

  // Financials
  amount:   { type: Number, required: true }, // total paid
  currency: { type: String, default: 'INR' },

  // Razorpay
  razorpayOrderId:   { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },

  // Status flow
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled'],
    default: 'pending',
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', orderSchema);