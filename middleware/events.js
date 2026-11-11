// Tiny Server-Sent Events hub: gives the admin dashboard (and each customer) live updates without polling.
const clients = new Set();

exports.subscribe = (req, res, user) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('retry: 5000\n\n');
  const client = { res, userId: String(user._id), role: user.role };
  clients.add(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); clients.delete(client); });
};

// Admins receive every event; a customer only receives events addressed to them.
exports.emit = (event, data, userId) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (c.role === 'admin' || (userId && c.userId === String(userId))) c.res.write(payload);
  }
};
