const express = require('express');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ── POST /api/auth/signup ──────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, role, location } = req.body;
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success: false, message: 'Email already registered' });

    const user = await User.create({ firstName, lastName, email, password, phone, role, location });
    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, role: user.role, phone: user.phone,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/auth/login ───────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = signToken(user._id);
    res.json({
      success: true,
      token,
      user: {
        id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, role: user.role, phone: user.phone,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/auth/me ───────────────────────────────
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id).populate('wishlist', 'title salePrice images status');
  res.json({ success: true, user });
});

// ── PUT /api/auth/profile ──────────────────────────
router.put('/profile', protect, async (req, res) => {
  try {
    const updates = {};
    ['firstName','lastName','phone','location','avatar'].forEach(k => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/auth/wishlist/:productId ─────────────
router.post('/wishlist/:productId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const pid  = req.params.productId;
    const idx  = user.wishlist.indexOf(pid);
    let action;
    if (idx > -1) { user.wishlist.splice(idx, 1); action = 'removed'; }
    else          { user.wishlist.push(pid);        action = 'added'; }
    await user.save();
    res.json({ success: true, action, wishlist: user.wishlist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;