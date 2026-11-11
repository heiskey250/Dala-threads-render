// Run once:  npm run seed
// Creates the admin account, the 4 categories and the 50 products from product.html. Safe to run again:
// existing products (and their stock) are left untouched.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Category = require('./models/Category');
const Product = require('./models/Product');

// [name, price FRW, category, badge] — position in the list = image number (bag1.jpg ... bag50.jpg)
const PRODUCTS = [
  ['Classic Beaded Bag',25000,'bag','New'],['Elegant Bead Purse',30000,'purse','Popular'],['Luxury Handbag',40000,'bag'],
  ['Petite Gold Purse',45000,'purse'],['Evening Clutch',48000,'clutch'],['Bridal Bead Bag',45000,'bag','Bridal'],
  ['Royal Handbag',50000,'bag'],['Mini Beaded Tote',20000,'bag'],['Heritage Bag',40000,'bag'],
  ['Triangle Bag',40000,'bag'],['Blue Bag',40000,'bag'],['Green Bag',40000,'bag'],
  ['Elegant Bag',40000,'bag'],['Light-Blue Bag',40000,'bag'],['Classic Purse',40000,'purse'],
  ['Occasional Bag',40000,'bag'],['White BackPack',40000,'backpack'],['Fashion BackPack',40000,'backpack'],
  ['Mothers Bag',40000,'bag'],['Evening Bag',40000,'bag'],['Wedding Bag',40000,'bag','Bridal'],
  ['Queen Purse',40000,'purse'],
  ['Sunset Beaded Tote',35000,'bag'],['Ruby Evening Clutch',46000,'clutch'],['Ivory Bridal Purse',42000,'purse','Bridal'],
  ['Safari Backpack',42000,'backpack'],['Amber Handbag',38000,'bag'],['Midnight Clutch',50000,'clutch','New'],
  ['Rose Petal Purse',32000,'purse'],['Kigali Weekender',55000,'bag','Popular'],['Savannah Bag',38000,'bag'],
  ['Pearl Clutch',47000,'clutch'],['Teal Bead Backpack',44000,'backpack','New'],['Coral Mini Purse',28000,'purse'],
  ['Golden Hour Bag',45000,'bag'],['Imigongo Pattern Bag',48000,'bag','Heritage'],['Lavender Purse',33000,'purse'],
  ['Emerald Handbag',42000,'bag'],['Pink Blossom Bag',36000,'bag'],['Gala Night Clutch',52000,'clutch','New'],
  ['Everyday Tote',30000,'bag'],['Campus Backpack',38000,'backpack'],['Crimson Purse',34000,'purse'],
  ['Silver Thread Bag',46000,'bag'],['Mama Africa Bag',40000,'bag','Popular'],['Mini Cross-body Bag',26000,'bag'],
  ['Royal Blue Clutch',49000,'clutch'],['Honey Gold Purse',37000,'purse'],['Rainbow Bead Bag',43000,'bag','New'],
  ['Signature Collection Bag',60000,'bag','Premium'],
];

const CATEGORIES = { bag: 'Bags', purse: 'Purses', clutch: 'Clutches', backpack: 'Backpacks' };
const STARTING_STOCK = 10;   // placeholder: set the real quantities in the admin dashboard

(async () => {
  await connectDB();

  const email = (process.env.ADMIN_EMAIL || 'admin@dalathreads.com').toLowerCase();
  if (!(await User.exists({ email }))) {
    await User.create({ firstName: 'Dala', lastName: 'Admin', email, password: process.env.ADMIN_PASSWORD || 'ChangeThisPassword123', role: 'admin' });
    console.log(`Admin created: ${email}`);
  } else console.log(`Admin already exists: ${email}`);

  const cats = {};
  for (const [slug, name] of Object.entries(CATEGORIES)) {
    cats[slug] = await Category.findOneAndUpdate({ slug }, { $setOnInsert: { slug, name } }, { upsert: true, returnDocument: 'after' });
  }

  let created = 0;
  for (const [i, [name, price, tag, badge]] of PRODUCTS.entries()) {
    const number = i + 1;
    const res = await Product.updateOne({ number }, {
      $setOnInsert: { number, name, price, badge: badge || '', category: cats[tag]._id, image: `bag${number}.jpg`, stock: STARTING_STOCK, featured: number <= 6, active: true },
    }, { upsert: true });
    if (res.upsertedCount) created++;
  }
  console.log(`Categories ready: ${Object.keys(cats).length}. Products created: ${created} (of ${PRODUCTS.length}).`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
