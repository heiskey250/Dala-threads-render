const router = require('express').Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { body } = require('express-validator');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const validate = require('../middleware/validate');
const events = require('../middleware/events');
const { protect, adminOnly } = require('../middleware/auth');
const { httpError } = require('../middleware/error');

const METHODS = ['momo-ussd', 'whatsapp', 'cash-on-delivery', 'bank-transfer'];
const SHIPPING_FEE = Number(process.env.SHIPPING_FEE || 0);
const qty = (v) => Math.min(Math.max(parseInt(v) || 1, 1), 99);

const momoNumber = () => process.env.MOMO_NUMBER || '0795013119';
const ussdFor = (total) => ({ code: `*182*1*1*${momoNumber()}*${total}#`, link: `tel:*182*1*1*${momoNumber()}*${total}%23` });

const newOrderNumber = () => `DT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomInt(1000, 10000)}`;

async function restoreStock(order) {
  await Promise.all(order.items.filter((i) => i.product).map((i) =>
    Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity, sold: -i.quantity } })));
}

// Single place where an order changes status, so history, stock and live events always stay consistent.
async function applyStatus(order, status, by, note) {
  if (!Order.STATUSES.includes(status)) throw httpError(400, 'Unknown order status.');
  if (order.status === status) return order;
  if (order.status === 'cancelled') throw httpError(409, 'A cancelled order cannot be changed.');
  if (status === 'cancelled') {
    if (order.status === 'delivered') throw httpError(409, 'A delivered order cannot be cancelled.');
    await restoreStock(order);
    if (order.paymentStatus === 'unpaid') {
      order.paymentStatus = 'failed';
      await Payment.updateOne({ _id: order.payment }, { status: 'failed', note: 'Order cancelled' });
    }
  }
  order.status = status;
  order.statusHistory.push({ status, note, by: by && by._id });
  if (status === 'delivered' && order.paymentMethod === 'cash-on-delivery' && order.paymentStatus === 'unpaid') {
    order.paymentStatus = 'paid';
    await Payment.updateOne({ _id: order.payment }, { status: 'confirmed', confirmedAt: new Date(), confirmedBy: by && by._id });
  }
  await order.save();
  events.emit('order:status', { orderId: order._id, orderNumber: order.orderNumber, status }, order.user);
  return order;
}

router.post('/', protect, [
  body('shippingAddress.fullName').trim().notEmpty().withMessage('Full name is required.'),
  body('shippingAddress.address').trim().notEmpty().withMessage('Delivery address is required.'),
  body('paymentMethod').optional().isIn(METHODS).withMessage('Unknown payment method.'),
  body('items').optional().isArray({ max: 100 }).withMessage('Items must be a list.'),
], validate, async (req, res) => {
  // 1. What is being ordered: the items sent, otherwise the saved cart
  let lines;
  if (Array.isArray(req.body.items) && req.body.items.length) {
    lines = req.body.items.map((i) => ({ productId: i.productId, productNumber: i.productNumber, quantity: qty(i.quantity) }));
  } else {
    const cart = await Cart.findOne({ user: req.user._id });
    lines = (cart ? cart.items : []).map((i) => ({ productId: i.product, quantity: i.quantity }));
  }
  if (!lines.length) throw httpError(400, 'Your bag is empty.');

  // 2. Look every product up in the database: prices always come from here, never from the browser
  const merged = new Map();
  for (const l of lines) {
    let product = null;
    if (l.productId && mongoose.isValidObjectId(l.productId)) product = await Product.findOne({ _id: l.productId, active: true });
    else if (l.productNumber) product = await Product.findOne({ number: Number(l.productNumber), active: true });
    if (!product) throw httpError(404, 'One of the products in your order is no longer available.');
    const key = String(product._id);
    merged.set(key, { product, quantity: (merged.get(key) ? merged.get(key).quantity : 0) + l.quantity });
  }

  // 3. Reserve stock one product at a time (each step is atomic); undo everything if any step fails
  const reserved = [];
  let order = null;
  try {
    for (const { product, quantity } of merged.values()) {
      const updated = await Product.findOneAndUpdate(
        { _id: product._id, active: true, stock: { $gte: quantity } },
        { $inc: { stock: -quantity, sold: quantity } },
      );
      if (!updated) throw httpError(409, `Sorry, "${product.name}" has fewer than ${quantity} piece(s) left.`);
      reserved.push({ id: product._id, quantity });
    }

    const items = [...merged.values()].map(({ product, quantity }) => ({
      product: product._id, number: product.number, name: product.name, price: product.price, image: product.image, quantity,
    }));
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + SHIPPING_FEE;
    const method = req.body.paymentMethod || 'momo-ussd';
    const a = req.body.shippingAddress;

    for (let attempt = 0; !order; attempt++) {
      try {
        order = await Order.create({
          orderNumber: newOrderNumber(), user: req.user._id, items, subtotal, shippingFee: SHIPPING_FEE, total,
          shippingAddress: { fullName: a.fullName, phone: a.phone || req.user.phone, address: a.address, city: a.city, notes: a.notes },
          paymentMethod: method,
          statusHistory: [{ status: 'pending', note: 'Order placed', by: req.user._id }],
        });
      } catch (e) { if (e.code !== 11000 || attempt >= 4) throw e; }   // order-number clash: try another number
    }
    const payment = await Payment.create({ order: order._id, user: req.user._id, method, amount: total });
    order.payment = payment._id;
    await order.save();

    await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
    events.emit('order:new', { orderId: order._id, orderNumber: order.orderNumber, total, customer: a.fullName }, req.user._id);
    res.status(201).json({ order, payment, ussd: method === 'momo-ussd' ? ussdFor(total) : undefined });
  } catch (err) {
    if (order) await Order.deleteOne({ _id: order._id });
    await Promise.all(reserved.map((r) => Product.updateOne({ _id: r.id }, { $inc: { stock: r.quantity, sold: -r.quantity } })));
    throw err;
  }
});

router.get('/mine', protect, async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort('-createdAt').populate('payment', 'status reference method');
  res.json({ orders });
});

// Admin: list every order. Filters: status, paymentStatus, search (order number), page, limit
router.get('/', protect, adminOnly, async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.search) filter.orderNumber = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 40), 'i');
  const [orders, total] = await Promise.all([
    Order.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit)
      .populate('user', 'firstName lastName email phone').populate('payment', 'status reference method'),
    Order.countDocuments(filter),
  ]);
  res.json({ orders, total, page, pages: Math.ceil(total / limit) || 1 });
});

router.get('/:id', protect, async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'firstName lastName email phone').populate('payment');
  const owner = order && String(order.user._id) === String(req.user._id);
  if (!order || (!owner && req.user.role !== 'admin')) throw httpError(404, 'Order not found.');
  res.json({ order });
});

router.post('/:id/cancel', protect, async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw httpError(404, 'Order not found.');
  if (order.status !== 'pending' || order.paymentStatus !== 'unpaid') {
    throw httpError(409, 'This order can no longer be cancelled online. Please contact Dala Threads.');
  }
  await applyStatus(order, 'cancelled', req.user, 'Cancelled by customer');
  res.json({ order });
});

router.patch('/:id/status', protect, adminOnly, [
  body('status').isIn(Order.STATUSES).withMessage('Unknown order status.'),
  body('note').optional().trim().isLength({ max: 300 }),
], validate, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw httpError(404, 'Order not found.');
  await applyStatus(order, req.body.status, req.user, req.body.note);
  res.json({ order });
});

module.exports = router;
module.exports.applyStatus = applyStatus;
