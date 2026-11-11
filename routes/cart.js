const router = require('express').Router();
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const { httpError } = require('../middleware/error');

router.use(protect);

async function view(userId) {
  const cart = await Cart.findOne({ user: userId }).populate('items.product', 'number name price image stock active');
  const items = (cart ? cart.items : [])
    .filter((i) => i.product && i.product.active)
    .map((i) => ({ product: i.product, quantity: i.quantity, lineTotal: i.product.price * i.quantity }));
  return { items, count: items.reduce((n, i) => n + i.quantity, 0), total: items.reduce((n, i) => n + i.lineTotal, 0) };
}

async function findProduct({ productId, productNumber }) {
  if (productId && mongoose.isValidObjectId(productId)) return Product.findOne({ _id: productId, active: true });
  if (productNumber) return Product.findOne({ number: Number(productNumber), active: true });
  return null;
}

const qty = (v) => Math.min(Math.max(parseInt(v) || 1, 1), 99);

router.get('/', async (req, res) => res.json(await view(req.user._id)));

router.post('/items', async (req, res) => {
  const product = await findProduct(req.body);
  if (!product) throw httpError(404, 'Product not found.');
  const cart = (await Cart.findOne({ user: req.user._id })) || new Cart({ user: req.user._id, items: [] });
  const existing = cart.items.find((i) => String(i.product) === String(product._id));
  const wanted = (existing ? existing.quantity : 0) + qty(req.body.quantity);
  if (wanted > product.stock) throw httpError(409, `Only ${product.stock} of "${product.name}" left in stock.`);
  if (existing) existing.quantity = wanted; else cart.items.push({ product: product._id, quantity: wanted });
  await cart.save();
  res.status(201).json(await view(req.user._id));
});

router.patch('/items/:productId', async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  const item = cart && cart.items.find((i) => String(i.product) === req.params.productId);
  if (!item) throw httpError(404, 'That item is not in your cart.');
  const product = await Product.findById(req.params.productId);
  const quantity = qty(req.body.quantity);
  if (product && quantity > product.stock) throw httpError(409, `Only ${product.stock} left in stock.`);
  item.quantity = quantity;
  await cart.save();
  res.json(await view(req.user._id));
});

router.delete('/items/:productId', async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $pull: { items: { product: req.params.productId } } });
  res.json(await view(req.user._id));
});

router.delete('/', async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  res.json(await view(req.user._id));
});

// After sign-in, push the browser's local cart into the account: { items: [{ productNumber, quantity }] }
router.post('/merge', async (req, res) => {
  const incoming = Array.isArray(req.body.items) ? req.body.items.slice(0, 100) : [];
  const cart = (await Cart.findOne({ user: req.user._id })) || new Cart({ user: req.user._id, items: [] });
  for (const entry of incoming) {
    const product = await findProduct(entry);
    if (!product || product.stock < 1) continue;
    const existing = cart.items.find((i) => String(i.product) === String(product._id));
    const quantity = Math.min((existing ? existing.quantity : 0) + qty(entry.quantity), product.stock);
    if (existing) existing.quantity = quantity; else cart.items.push({ product: product._id, quantity });
  }
  await cart.save();
  res.json(await view(req.user._id));
});

module.exports = router;
