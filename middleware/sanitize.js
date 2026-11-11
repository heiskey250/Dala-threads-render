// Blocks NoSQL operator injection (e.g. {"email": {"$gt": ""}}) by removing keys that start with "$" or contain ".".
// Mutates in place because req.query is read-only in Express 5.
function clean(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) delete obj[key];
    else clean(obj[key]);
  }
}

module.exports = (req, _res, next) => {
  clean(req.body); clean(req.query); clean(req.params);
  next();
};
