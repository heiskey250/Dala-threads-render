const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const multer = require('multer');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');
const { httpError } = require('../middleware/error');
const { slugify } = require('./categories');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp)$/.test(file.mimetype) ? cb(null, true) : cb(httpError(400, 'Only JPG, PNG or WEBP images are allowed.')),
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORTS = { newest: '-createdAt', price_asc: 'price', price_desc: '-price', name: 'name', popular: '-sold', number: 'number' };
const FIELDS = ['name', 'description', 'price', 'badge', 'image', 'stock', 'lowStockThreshold', 'featured', 'active', 'number'];

// A category can be given as an id, a slug ("clutch") or a new name; admins creating a new name creates the category.
async function resolveCategory(value) {
  if (!value) return null;
  if (mongoose.isValidObjectId(value)) return Category.findById(value);
  return Category.findOneAndUpdate(
    { slug: slugify(value) },
    { $setOnInsert: { name: String(value).trim(), slug: slugify(value) } },
    { upsert: true, returnDocument: 'after' },
  );
}

const toBool = (v) => (typeof v === 'string' ? v === 'true' || v === '1' || v === 'on' : v);

function pickFields(body) {
  const data = {};
  for (const f of FIELDS) if (body[f] !== undefined && body[f] !== '') data[f] = body[f];
  for (const f of ['featured', 'active']) if (data[f] !== undefined) data[f] = toBool(data[f]);
  return data;
}

router.get('/', optionalAuth, async (req, res) => {
  const { category, search, minPrice, maxPrice, featured, sort = 'number' } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const isAdmin = req.user && req.user.role === 'admin';

  const filter = {};
  if (!(isAdmin && req.query.includeInactive === 'true')) filter.active = true;
  if (category) {
    const cat = mongoose.isValidObjectId(category) ? { _id: category } : { slug: String(category).toLowerCase() };
    const found = await Category.findOne(cat);
    filter.category = found ? found._id : null;
  }
  if (search) {
    const rx = new RegExp(escapeRegex(String(search).slice(0, 60)), 'i');
    filter.$or = [{ name: rx }, { description: rx }, { badge: rx }];
  }
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (featured === 'true') filter.featured = true;

  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', 'name slug').sort(SORTS[sort] || SORTS.number).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ products, total, page, pages: Math.ceil(total / limit) || 1 });
});

router.get('/:id', optionalAuth, async (req, res) => {
  const query = mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id } : { number: Number(req.params.id) };
  const product = await Product.findOne(query).populate('category', 'name slug');
  const isAdmin = req.user && req.user.role === 'admin';
  if (!product || (!product.active && !isAdmin)) throw httpError(404, 'Product not found.');
  res.json({ product });
});

router.post('/', protect, adminOnly, upload.single('image'), async (req, res) => {
  const data = pickFields(req.body);
  if (!data.name || data.price === undefined) throw httpError(400, 'Name and price are required.');
  const category = await resolveCategory(req.body.category);
  if (!category) throw httpError(400, 'A category is required.');
  if (data.number === undefined) {
    const last = await Product.findOne().sort('-number').select('number');
    data.number = (last && last.number ? last.number : 0) + 1;
  }
  if (req.file) data.image = `/uploads/${req.file.filename}`;
  const product = await Product.create({ ...data, category: category._id });
  res.status(201).json({ product: await product.populate('category', 'name slug') });
});

router.put('/:id', protect, adminOnly, upload.single('image'), async (req, res) => {
  const data = pickFields(req.body);
  if (req.body.category) {
    const category = await resolveCategory(req.body.category);
    if (!category) throw httpError(400, 'Category not found.');
    data.category = category._id;
  }
  if (req.file) data.image = `/uploads/${req.file.filename}`;
  const product = await Product.findByIdAndUpdate(req.params.id, data, { returnDocument: 'after', runValidators: true }).populate('category', 'name slug');
  if (!product) throw httpError(404, 'Product not found.');
  res.json({ product });
});

// Inventory: set an exact amount ({stock: 12}) or adjust ({delta: -2}, {delta: 10})
router.patch('/:id/stock', protect, adminOnly, async (req, res) => {
  const { stock, delta } = req.body;
  let product;
  if (stock !== undefined) {
    if (!Number.isInteger(+stock) || +stock < 0) throw httpError(400, 'Stock must be a whole number, 0 or more.');
    product = await Product.findByIdAndUpdate(req.params.id, { stock: +stock }, { returnDocument: 'after' });
  } else if (delta !== undefined && Number.isInteger(+delta)) {
    product = await Product.findOneAndUpdate({ _id: req.params.id, stock: { $gte: -Number(delta) } }, { $inc: { stock: +delta } }, { returnDocument: 'after' });
    if (!product) throw httpError(409, 'That adjustment would make stock negative.');
  } else throw httpError(400, 'Send either "stock" or "delta".');
  if (!product) throw httpError(404, 'Product not found.');
  res.json({ product });
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw httpError(404, 'Product not found.');
  if (product.image && product.image.startsWith('/uploads/')) {
    fs.unlink(path.join(uploadDir, path.basename(product.image)), () => {});
  }
  res.json({ message: 'Product deleted.' });
});

module.exports = router;
