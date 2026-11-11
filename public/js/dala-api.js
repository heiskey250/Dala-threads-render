/* Dala Threads — tiny client for the backend API.
   Add  <script src="js/dala-api.js"></script>  to any page, then use window.DalaAPI.
   If the pages are served by the backend (http://localhost:5000) it just works.
   If you open them from another server (e.g. Live Server), it talks to http://localhost:5000 —
   change that with:  <script>window.DALA_API_BASE = 'https://your-api.example.com'</script>  before this file. */
(function () {
  const BASE = (window.DALA_API_BASE !== undefined ? window.DALA_API_BASE
    : (location.port === '1000' ? '' : 'http://localhost:1000')).replace(/\/$/, '');

  const store = {
    get token() { return localStorage.getItem('dtToken'); },
    set token(v) { v ? localStorage.setItem('dtToken', v) : localStorage.removeItem('dtToken'); },
    get user() { try { return JSON.parse(localStorage.getItem('dtUser')); } catch { return null; } },
    set user(v) { v ? localStorage.setItem('dtUser', JSON.stringify(v)) : localStorage.removeItem('dtUser'); },
  };

  async function request(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(`${BASE}/api${path}`, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(store.token ? { Authorization: `Bearer ${store.token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        keepalive: method !== 'GET',
      });
    } catch { throw new Error('Cannot reach the Dala Threads server. Please try again.'); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && store.token) { store.token = null; store.user = null; }   // expired session
    if (!res.ok) throw Object.assign(new Error(data.message || 'Something went wrong.'), { status: res.status });
    return data;
  }

  const remember = (data) => { store.token = data.token; store.user = data.user; return data.user; };

  window.DalaAPI = {
    base: BASE,
    // account
    isLoggedIn: () => !!store.token,
    user: () => store.user,
    isAdmin: () => !!(store.user && store.user.role === 'admin'),
    register: async (p) => remember(await request('/auth/register', { method: 'POST', body: p })),
    login: async (email, password) => remember(await request('/auth/login', { method: 'POST', body: { email, password } })),
    logout: () => { store.token = null; store.user = null; },
    me: async () => { const { user } = await request('/auth/me'); store.user = user; return user; },
    updateProfile: async (p) => { const { user } = await request('/auth/me', { method: 'PUT', body: p }); store.user = user; return user; },
    // shop
    products: (query = {}) => request('/products?' + new URLSearchParams(query)),
    product: (idOrNumber) => request('/products/' + idOrNumber),
    categories: () => request('/categories'),
    imageUrl: (p) => (!p.image ? '' : /^(https?:)?\//.test(p.image) ? (p.image.startsWith('/') ? BASE + p.image : p.image) : p.image),
    // cart (saved on the account)
    cart: () => request('/cart'),
    addToCart: (productNumber, quantity = 1) => request('/cart/items', { method: 'POST', body: { productNumber, quantity } }),
    setCartQuantity: (productId, quantity) => request('/cart/items/' + productId, { method: 'PATCH', body: { quantity } }),
    removeFromCart: (productId) => request('/cart/items/' + productId, { method: 'DELETE' }),
    mergeCart: (items) => request('/cart/merge', { method: 'POST', body: { items } }),
    // orders
    placeOrder: (p) => request('/orders', { method: 'POST', body: p }),
    myOrders: () => request('/orders/mine'),
    cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: 'POST' }),
    sendMoMoReference: (paymentId, reference) => request(`/payments/${paymentId}/reference`, { method: 'POST', body: { reference } }),
    // contact form
    sendMessage: (p) => request('/messages', { method: 'POST', body: p }),
    myMessages: () => request('/messages/mine'),
    // live updates for the signed-in customer, e.g.  DalaAPI.listen('order:status', d => ...)
    listen(event, handler) {
      if (!store.token || !window.EventSource) return () => {};
      const es = new EventSource(`${BASE}/api/events?token=${encodeURIComponent(store.token)}`);
      es.addEventListener(event, (e) => handler(JSON.parse(e.data)));
      return () => es.close();
    },
  };
})();
