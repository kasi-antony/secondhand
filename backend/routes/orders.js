const express  = require('express');
const crypto   = require('crypto');
const Razorpay = require('razorpay');
const Order    = require('../models/Order');
const Product  = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── POST /api/orders/create-order ─────────────────
// Step 1: Create Razorpay order and save pending Order doc
router.post('/create-order', protect, async (req, res) => {
  try {
    const { productId, orderType, rentalDays } = req.body;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.status === 'sold') return res.status(400).json({ success: false, message: 'Product already sold' });

    // Calculate amount (paise for Razorpay)
    let amount, depositAmount = 0;
    if (orderType === 'rental') {
      if (!product.rentPerDay || !rentalDays)
        return res.status(400).json({ success: false, message: 'Rental info missing' });
      depositAmount = product.rentPerDay * 2;
      amount = product.rentPerDay * rentalDays + depositAmount;
    } else {
      amount = product.salePrice;
    }

    const amountPaise = amount * 100;

    // Create Razorpay order
    const rzpOrder = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `order_${Date.now()}`,
      notes: { productId, buyerId: req.user._id.toString(), orderType },
    });

    // Save pending order
    const rentalEnd = orderType === 'rental'
      ? new Date(Date.now() + rentalDays * 86400000)
      : undefined;

    const order = await Order.create({
      buyer:           req.user._id,
      seller:          product.seller,
      product:         productId,
      orderType,
      rentalDays:      orderType === 'rental' ? rentalDays : undefined,
      rentalStart:     orderType === 'rental' ? new Date() : undefined,
      rentalEnd,
      depositAmount:   orderType === 'rental' ? depositAmount : 0,
      amount,
      razorpayOrderId: rzpOrder.id,
    });

    res.json({
      success: true,
      orderId:    order._id,
      rzpOrderId: rzpOrder.id,
      amount:     amountPaise,
      currency:   'INR',
      keyId:      process.env.RAZORPAY_KEY_ID,
      product: { title: product.title, image: product.images[0]?.url || '' },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/orders/verify-payment ───────────────
// Step 2: Verify Razorpay signature and confirm order
router.post('/verify-payment', protect, async (req, res) => {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    // Verify signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSig !== razorpaySignature)
      return res.status(400).json({ success: false, message: 'Payment verification failed' });

    // Update order
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    order.paymentStatus     = 'paid';
    order.orderStatus       = 'confirmed';
    await order.save();

    // Update product status
    await Product.findByIdAndUpdate(order.product, {
      status: order.orderType === 'rental' ? 'rented' : 'sold',
    });

    res.json({ success: true, message: 'Payment verified', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/orders/my ─────────────────────────────
router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .populate('product', 'title images')
      .populate('seller', 'firstName lastName')
      .sort('-createdAt');
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/orders/seller ─────────────────────────
router.get('/seller', protect, async (req, res) => {
  try {
    const orders = await Order.find({ seller: req.user._id })
      .populate('product', 'title images')
      .populate('buyer', 'firstName lastName phone')
      .sort('-createdAt');
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/orders/:id/status ─────────────────────
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findOne({ _id: req.params.id, seller: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.orderStatus = orderStatus;
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;