const router = require('express').Router();
const { body } = require('express-validator');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const validate = require('../middleware/validate');
const events = require('../middleware/events');
const { protect, adminOnly } = require('../middleware/auth');
const { httpError } = require('../middleware/error');
const { applyStatus } = require('./orders');

router.use(protect);

// Customer: after paying by MoMo, send the transaction ID so the shop can verify it
router.post('/:id/reference', [
  body('reference').trim().isLength({ min: 4, max: 80 }).withMessage('Enter the transaction ID from your MoMo message.'),
], validate, async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, user: req.user._id }).populate('order', 'orderNumber');
  if (!payment) throw httpError(404, 'Payment not found.');
  if (payment.status === 'confirmed') throw httpError(409, 'This payment is already confirmed.');
  payment.reference = req.body.reference;
  await payment.save();
  events.emit('payment:reference', { paymentId: payment._id, orderNumber: payment.order && payment.order.orderNumber, reference: payment.reference });
  res.json({ payment });
});

router.get('/', adminOnly, async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const payments = await Payment.find(filter).sort('-createdAt').limit(200)
    .populate('order', 'orderNumber total status').populate('user', 'firstName lastName phone');
  res.json({ payments });
});

// Admin: confirm / fail / refund a payment; the order's payment status follows
router.patch('/:id', adminOnly, [
  body('status').isIn(['pending', 'confirmed', 'failed', 'refunded']).withMessage('Unknown payment status.'),
], validate, async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw httpError(404, 'Payment not found.');
  const order = await Order.findById(payment.order);

  payment.status = req.body.status;
  if (req.body.reference) payment.reference = req.body.reference;
  if (req.body.note) payment.note = req.body.note;
  if (req.body.status === 'confirmed') { payment.confirmedBy = req.user._id; payment.confirmedAt = new Date(); }
  await payment.save();

  if (order) {
    order.paymentStatus = { pending: 'unpaid', confirmed: 'paid', failed: 'failed', refunded: 'refunded' }[req.body.status];
    if (req.body.status === 'confirmed' && order.status === 'pending') await applyStatus(order, 'confirmed', req.user, 'Payment confirmed');
    else await order.save();
    events.emit('order:status', { orderId: order._id, orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus }, order.user);
  }
  res.json({ payment });
});

module.exports = router;
