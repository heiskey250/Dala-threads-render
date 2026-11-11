const router = require('express').Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');
const { httpError } = require('../middleware/error');

const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

router.get('/', async (_req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find().sort('name'),
    Product.aggregate([{ $match: { active: true } }, { $group: { _id: '$category', n: { $sum: 1 } } }]),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ categories: categories.map((c) => ({ ...c.toJSON(), productCount: byId.get(String(c._id)) || 0 })) });
});

router.post('/', protect, adminOnly, async (req, res) => {
  const { name, description } = req.body;
  if (!name || !String(name).trim()) throw httpError(400, 'Category name is required.');
  const category = await Category.create({ name: String(name).trim(), slug: slugify(name), description });
  res.status(201).json({ category });
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  const update = {};
  if (req.body.name) { update.name = String(req.body.name).trim(); update.slug = slugify(req.body.name); }
  if (req.body.description !== undefined) update.description = req.body.description;
  const category = await Category.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true });
  if (!category) throw httpError(404, 'Category not found.');
  res.json({ category });
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  if (await Product.exists({ category: req.params.id })) throw httpError(409, 'Move or delete this category\'s products first.');
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw httpError(404, 'Category not found.');
  res.json({ message: 'Category deleted.' });
});

module.exports = router;
module.exports.slugify = slugify;
