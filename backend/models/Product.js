const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['Electronics','Books & Study','Furniture','Clothing','Sports & Fitness','Photography','Vehicles','Other'],
    required: true,
  },
  condition:   { type: String, enum: ['Like New','Good','Fair','For Parts'], required: true },
  images:      [{ url: String, publicId: String }],
  location:    { type: String, required: true },

  // Listing type
  listingType: { type: String, enum: ['sale','rent','both'], default: 'sale' },

  // Sale fields
  salePrice:   { type: Number },

  // Rent fields
  rentPerDay:  { type: Number },
  maxRentDays: { type: Number },
  minRentDays: { type: Number, default: 1 },
  depositAmount: { type: Number }, // auto-calculated as rentPerDay * 2

  // Status
  status: {
    type: String,
    enum: ['available','rented','sold','inactive'],
    default: 'available',
  },

  views:       { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

productSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  if (this.rentPerDay) this.depositAmount = this.rentPerDay * 2;
  next();
});

productSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);