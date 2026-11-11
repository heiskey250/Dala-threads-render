// Usage:  npm run make-admin -- someone@example.com
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  const email = (process.argv[2] || '').toLowerCase();
  if (!email) { console.error('Usage: npm run make-admin -- someone@example.com'); process.exit(1); }
  await connectDB();
  const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { returnDocument: 'after' });
  console.log(user ? `${email} is now an admin.` : `No account found for ${email}. Register on the site first.`);
  await mongoose.disconnect();
})();
