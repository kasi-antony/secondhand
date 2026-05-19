const express = require('express');
const Product = require('../models/Product');
const { protect, requireRole } = require('../middleware/auth');
const { upload, cloudinary } = require('../config/cloudinary');

const router = express.Router();

// ── GET /api/products ──────────────────────────────
// Public: browse with filters
router.get('/', async (req, res) => {
  try {
    const { q, category, type, condition, minPrice, maxPrice, sort, page = 1, limit = 20 } = req.query;
    const filter = { status: { $in: ['available', 'rented'] } };

    if (q) filter.$text = { $search: q };
    if (category) filter.category = category;
    if (condition) filter.condition = condition;
    if (type && type !== 'all') {
      if (type === 'sale') filter.listingType = { $in: ['sale', 'both'] };
      else if (type === 'rent') filter.listingType = { $in: ['rent', 'both'] };
      else filter.listingType = type;
    }
    if (minPrice || maxPrice) {
      filter.salePrice = {};
      if (minPrice) filter.salePrice.$gte = Number(minPrice);
      if (maxPrice) filter.salePrice.$lte = Number(maxPrice);
    }

    const sortMap = { newest: '-createdAt', oldest: 'createdAt', price_asc: 'salePrice', price_desc: '-salePrice' };
    const sortBy  = sortMap[sort] || '-createdAt';

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort(sortBy)
      .skip(skip)
      .limit(Number(limit))
      .populate('seller', 'firstName lastName location');

    res.json({ success: true, total, page: Number(page), products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/products/:id ──────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id, { $inc: { views: 1 } }, { new: true }
    ).populate('seller', 'firstName lastName location phone');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/products ─────────────────────────────
// Seller only — with up to 4 images
router.post('/', protect, requireRole('seller'), upload.array('images', 4), async (req, res) => {
  try {
    const { title, description, category, condition, location, listingType, salePrice, rentPerDay, maxRentDays, minRentDays } = req.body;
    const images = (req.files || []).map(f => ({ url: f.path, publicId: f.filename }));

    const product = await Product.create({
      seller: req.user._id,
      title, description, category, condition, location, listingType, images,
      salePrice:   salePrice   ? Number(salePrice)   : undefined,
      rentPerDay:  rentPerDay  ? Number(rentPerDay)  : undefined,
      maxRentDays: maxRentDays ? Number(maxRentDays) : undefined,
      minRentDays: minRentDays ? Number(minRentDays) : 1,
    });

    res.status(201).json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/products/:id ──────────────────────────
router.put('/:id', protect, requireRole('seller'), async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, seller: req.user._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found or not yours' });

    const allowed = ['title','description','category','condition','location','listingType','salePrice','rentPerDay','maxRentDays','minRentDays','status'];
    allowed.forEach(k => { if (req.body[k] !== undefined) product[k] = req.body[k]; });
    await product.save();
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/products/:id ───────────────────────
router.delete('/:id', protect, requireRole('seller'), async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, seller: req.user._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Remove images from Cloudinary
    for (const img of product.images) {
      if (img.publicId) await cloudinary.uploader.destroy(img.publicId);
    }
    await product.deleteOne();
    res.json({ success: true, message: 'Listing deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/products/seller/my ────────────────────
router.get('/seller/my', protect, requireRole('seller'), async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user._id }).sort('-createdAt');
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;