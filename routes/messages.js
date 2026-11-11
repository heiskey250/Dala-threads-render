const router = require('express').Router();
const { body } = require('express-validator');
const Message = require('../models/Message');
const validate = require('../middleware/validate');
const events = require('../middleware/events');
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');
const { httpError } = require('../middleware/error');

// Public: the contact form
router.post('/', optionalAuth, [
  body('name').trim().notEmpty().withMessage('Please enter your name.'),
  body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('subject').optional().isIn(['order', 'question', 'wholesale', 'other']).withMessage('Unknown subject.'),
  body('message').trim().isLength({ min: 3, max: 2000 }).withMessage('Please write a message (up to 2000 characters).'),
], validate, async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  const doc = await Message.create({ name, email, phone, subject, message, user: req.user && req.user._id });
  events.emit('message:new', { messageId: doc._id, name, subject });
  res.status(201).json({ message: 'Thank you! Your message has reached Dala Threads.', id: doc._id });
});

// A signed-in customer can read replies to what they sent
router.get('/mine', protect, async (req, res) => {
  const messages = await Message.find({ $or: [{ user: req.user._id }, { email: req.user.email }] }).sort('-createdAt');
  res.json({ messages });
});

// ── Admin ──
router.get('/', protect, adminOnly, async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
  const filter = req.query.status ? { status: req.query.status } : {};
  const [messages, total, unread] = await Promise.all([
    Message.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit),
    Message.countDocuments(filter),
    Message.countDocuments({ status: 'new' }),
  ]);
  res.json({ messages, total, unread, page, pages: Math.ceil(total / limit) || 1 });
});

router.patch('/:id/read', protect, adminOnly, async (req, res) => {
  const msg = await Message.findOneAndUpdate({ _id: req.params.id, status: 'new' }, { status: 'read' }, { returnDocument: 'after' })
    || await Message.findById(req.params.id);
  if (!msg) throw httpError(404, 'Message not found.');
  res.json({ message: msg });
});

router.post('/:id/reply', protect, adminOnly, [
  body('text').trim().isLength({ min: 1, max: 2000 }).withMessage('Write a reply first.'),
], validate, async (req, res) => {
  const msg = await Message.findById(req.params.id);
  if (!msg) throw httpError(404, 'Message not found.');
  msg.reply = { text: req.body.text, by: req.user._id, at: new Date() };
  msg.status = 'replied';
  await msg.save();
  if (msg.user) events.emit('message:reply', { messageId: msg._id }, msg.user);
  res.json({ message: msg });
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  const msg = await Message.findByIdAndDelete(req.params.id);
  if (!msg) throw httpError(404, 'Message not found.');
  res.json({ message: 'Message deleted.' });
});

module.exports = router;
