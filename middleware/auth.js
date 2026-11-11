const jwt = require('jsonwebtoken');
const User = require('../models/User');

const sign = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const verify = (token) => jwt.verify(token, process.env.JWT_SECRET);

// Always re-read the user so a deactivated account or changed role takes effect immediately.
async function userFromToken(token) {
  if (!token) return null;
  try {
    const user = await User.findById(verify(token).id);
    return user && user.isActive ? user : null;
  } catch { return null; }
}

const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

const protect = async (req, res, next) => {
  const user = await userFromToken(bearer(req));
  if (!user) return res.status(401).json({ message: 'Please sign in to continue.' });
  req.user = user;
  next();
};

const optionalAuth = async (req, _res, next) => {
  req.user = await userFromToken(bearer(req));
  next();
};

const adminOnly = (req, res, next) =>
  req.user && req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access only.' });

module.exports = { sign, userFromToken, protect, optionalAuth, adminOnly };
