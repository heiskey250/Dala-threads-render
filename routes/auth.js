const router = require('express').Router();
const { body } = require('express-validator');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { sign, protect } = require('../middleware/auth');
const { httpError } = require('../middleware/error');

const session = (user) => ({ token: sign(user), user });

router.post('/register', [
  body('firstName').trim().notEmpty().withMessage('First name is required.'),
  body('lastName').trim().notEmpty().withMessage('Last name is required.'),
  body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
], validate, async (req, res) => {
  const { firstName, lastName, email, phone, password } = req.body;
  if (await User.exists({ email })) throw httpError(409, 'An account with this email already exists.');
  // role is never taken from the request: every public sign-up is a customer
  const user = await User.create({ firstName, lastName, email, phone, password, role: 'customer' });
  res.status(201).json(session(user));
});

router.post('/login', [
  body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
], validate, async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  if (!user || !(await user.checkPassword(req.body.password))) throw httpError(401, 'Incorrect email or password.');
  if (!user.isActive) throw httpError(403, 'This account has been deactivated. Please contact Dala Threads.');
  user.lastLoginAt = new Date();
  await user.save();
  res.json(session(user));
});

router.get('/me', protect, (req, res) => res.json({ user: req.user }));

router.put('/me', protect, [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('address').optional().trim().isLength({ max: 200 }),
  body('city').optional().trim().isLength({ max: 80 }),
], validate, async (req, res) => {
  for (const f of ['firstName', 'lastName', 'phone', 'address', 'city']) {
    if (req.body[f] !== undefined) req.user[f] = req.body[f];
  }
  await req.user.save();
  res.json({ user: req.user });
});

router.put('/me/password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
], validate, async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.checkPassword(req.body.currentPassword))) throw httpError(401, 'Current password is incorrect.');
  user.password = req.body.newPassword;
  await user.save();
  res.json({ message: 'Password updated.' });
});

module.exports = router;
