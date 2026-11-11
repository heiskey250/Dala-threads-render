const router = require('express').Router();
const { userFromToken } = require('../middleware/auth');
const events = require('../middleware/events');

// EventSource can't send headers, so the token travels in the query string: /api/events?token=...
router.get('/', async (req, res) => {
  const user = await userFromToken(req.query.token);
  if (!user) return res.status(401).json({ message: 'Please sign in to continue.' });
  events.subscribe(req, res, user);
});

module.exports = router;
