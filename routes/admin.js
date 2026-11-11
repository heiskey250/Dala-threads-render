const router = require('express').Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Message = require('../models/Message');
const { protect, adminOnly } = require('../middleware/auth');
const { httpError } = require('../middleware/error');

router.use(protect, adminOnly);

router.get('/stats', async (_req, res) => {
  const [customers, products, totalOrders, pendingOrders, newMessages, revenue, byStatus, recentOrders, lowStock] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments({ active: true }),
    Order.countDocuments(),
    Order.countDocuments({ status: 'pending' }),
    Message.countDocuments({ status: 'new' }),
    Order.aggregate([{ $match: { paymentStatus: 'paid', status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Order.find().sort('-createdAt').limit(6).populate('user', 'firstName lastName'),
    Product.find({ active: true }).sort('stock').select('number name stock lowStockThreshold image'),
  ]);
  res.json({
    customers, products, totalOrders, pendingOrders, newMessages,
    revenue: revenue[0] ? revenue[0].total : 0,
    ordersByStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
    recentOrders,
    lowStock: lowStock.filter((p) => p.stock <= p.lowStockThreshold).slice(0, 10),
  });
});

router.get('/users', async (req, res) => {
  const filter = req.query.role ? { role: req.query.role } : {};
  const users = await User.find(filter).sort('-createdAt').limit(300);
  res.json({ users });
});

router.patch('/users/:id', async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw httpError(400, 'You cannot change your own account here.');
  const update = {};
  if (typeof req.body.isActive === 'boolean') update.isActive = req.body.isActive;
  if (['customer', 'admin'].includes(req.body.role)) update.role = req.body.role;
  const user = await User.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
  if (!user) throw httpError(404, 'User not found.');
  res.json({ user });
});

module.exports = router;
