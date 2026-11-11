/* Dala Threads — account menu shared by index, product, contact and services pages.
   When a customer is signed in it: hides the "Sign In" links, adds a settings (gear) button to the header,
   and opens a Settings panel with  My orders (purchase history)  ·  Profile  ·  Log out. */
(function () {
  if (!window.DalaAPI) return;
  const API = window.DalaAPI;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const frw = (n) => Number(n || 0).toLocaleString() + ' FRW';
  const when = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const initials = (u) => ((u.firstName || '?')[0] + ((u.lastName || '')[0] || '')).toUpperCase();

  const css = `
  .dt-gear{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:transparent;border:1px solid rgba(201,168,76,.45);color:#e8c97a;cursor:pointer;font-size:.95rem;transition:.25s;flex:none}
  .dt-gear:hover{background:rgba(201,168,76,.15);border-color:#c9a84c;transform:rotate(30deg)}
  .dt-ov{position:fixed;inset:0;background:rgba(5,2,12,.6);backdrop-filter:blur(3px);z-index:9998;opacity:0;pointer-events:none;transition:.3s}
  .dt-ov.open{opacity:1;pointer-events:auto}
  .dt-panel{position:fixed;top:0;right:0;height:100%;width:min(440px,100vw);background:linear-gradient(170deg,#1a0f30,#0f0820);color:#f5ede0;z-index:9999;transform:translateX(105%);transition:transform .35s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column;font-family:'Jost',system-ui,sans-serif;border-left:1px solid rgba(201,168,76,.25);box-shadow:-20px 0 60px rgba(0,0,0,.5)}
  .dt-panel.open{transform:none}
  .dt-panel *{box-sizing:border-box}
  .dt-head{display:flex;align-items:center;gap:14px;padding:20px 22px;border-bottom:1px solid rgba(201,168,76,.18)}
  .dt-av{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#c9a84c,#e8c97a);color:#1a1030;display:grid;place-items:center;font-weight:600;flex:none}
  .dt-who{min-width:0;flex:1}.dt-who b{display:block;font-family:'Cormorant Garamond',serif;font-size:1.25rem;color:#e8c97a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dt-who span{font-size:.78rem;color:rgba(245,237,224,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
  .dt-x{background:none;border:0;color:#f5ede0;font-size:1.2rem;cursor:pointer;opacity:.7}.dt-x:hover{opacity:1}
  .dt-tabs{display:flex;padding:0 22px;border-bottom:1px solid rgba(201,168,76,.18)}
  .dt-tab{flex:1;background:none;border:0;border-bottom:2px solid transparent;color:rgba(245,237,224,.55);padding:13px 4px;font:500 .85rem 'Jost',sans-serif;cursor:pointer;letter-spacing:.5px}
  .dt-tab.on{color:#e8c97a;border-color:#c9a84c}
  .dt-body{flex:1;overflow-y:auto;padding:18px 22px}
  .dt-foot{padding:16px 22px;border-top:1px solid rgba(201,168,76,.18);display:flex;gap:10px;flex-wrap:wrap}
  .dt-btn{border:0;border-radius:10px;padding:10px 16px;font:600 .82rem 'Jost',sans-serif;cursor:pointer;background:linear-gradient(135deg,#c9a84c,#e8c97a);color:#1a1030;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:.2s}
  .dt-btn:hover{transform:translateY(-1px)}
  .dt-btn.ghost{background:transparent;color:#f5ede0;border:1px solid rgba(201,168,76,.35)}
  .dt-btn.out{flex:1;justify-content:center;background:transparent;color:#ff8c8c;border:1px solid rgba(255,107,107,.45)}
  .dt-btn.out:hover{background:rgba(255,107,107,.12)}
  .dt-btn.sm{padding:6px 12px;font-size:.74rem}
  .dt-order{border:1px solid rgba(201,168,76,.2);border-radius:14px;padding:14px;margin-bottom:14px;background:rgba(201,168,76,.04)}
  .dt-row{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .dt-order .no{font-weight:600;letter-spacing:.5px}
  .dt-m{font-size:.76rem;color:rgba(245,237,224,.55)}
  .dt-pill{padding:3px 10px;border-radius:20px;font-size:.68rem;font-weight:500;text-transform:capitalize;background:rgba(201,168,76,.18);color:#e8c97a;white-space:nowrap}
  .dt-pill.ok{background:rgba(61,220,151,.16);color:#3ddc97}.dt-pill.warn{background:rgba(245,185,66,.16);color:#f5b942}.dt-pill.bad{background:rgba(255,107,107,.16);color:#ff8c8c}
  .dt-items{list-style:none;margin:10px 0;padding:0}
  .dt-items li{display:flex;align-items:center;gap:10px;padding:5px 0;font-size:.85rem}
  .dt-items img{width:38px;height:38px;border-radius:8px;object-fit:cover;background:#1e1235;flex:none}
  .dt-items .q{margin-left:auto;white-space:nowrap;color:rgba(245,237,224,.75)}
  .dt-total{display:flex;justify-content:space-between;border-top:1px dashed rgba(201,168,76,.25);padding-top:9px;font-weight:600}
  .dt-order details{margin-top:10px;font-size:.8rem}.dt-order summary{cursor:pointer;color:#e8c97a}
  .dt-order details ul{list-style:none;padding:8px 0 0;margin:0}.dt-order details li{padding:3px 0;color:rgba(245,237,224,.7)}
  .dt-act{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .dt-act input{flex:1;min-width:140px}
  .dt-in,.dt-form input{width:100%;background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.25);border-radius:9px;padding:9px 11px;color:#f5ede0;font:400 .88rem 'Jost',sans-serif;outline:none}
  .dt-in:focus,.dt-form input:focus{border-color:#c9a84c}
  .dt-form label{display:block;font-size:.66rem;letter-spacing:1.4px;text-transform:uppercase;color:rgba(245,237,224,.55);margin:12px 0 5px}
  .dt-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .dt-empty{text-align:center;padding:50px 10px;color:rgba(245,237,224,.55)}.dt-empty i{font-size:2rem;color:#c9a84c;margin-bottom:12px;display:block}
  .dt-note{font-size:.78rem;margin-top:10px;min-height:1em}
  .dt-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,90px);background:#1e1235;color:#f5ede0;border:1px solid #c9a84c;border-radius:12px;padding:12px 18px;z-index:10001;font:400 .88rem 'Jost',sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.5);transition:.35s;opacity:0;max-width:90vw}
  .dt-toast.show{transform:translate(-50%,0);opacity:1}
  .dt-signin-hidden{display:none!important}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  let gear, ov, panel, tab = 'orders', stopLive = null;

  function toast(msg) {
    let t = document.querySelector('.dt-toast');
    if (!t) { t = document.createElement('div'); t.className = 'dt-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3800);
  }

  // ── header: hide "Sign In", show the gear ──
  function render() {
    const logged = API.isLoggedIn();
    document.querySelectorAll('a[href="login.html"]').forEach((a) => a.classList.toggle('dt-signin-hidden', logged));
    if (logged && !gear) {
      const host = document.querySelector('.top-icons') || document.querySelector('header');
      if (!host) return;
      gear = document.createElement('button');
      gear.className = 'dt-gear'; gear.type = 'button'; gear.title = 'Settings'; gear.setAttribute('aria-label', 'Settings');
      gear.innerHTML = '<i class="fa-solid fa-gear"></i>';
      gear.onclick = open;
      host.insertBefore(gear, host.firstChild);
      startLive();
    } else if (!logged && gear) { gear.remove(); gear = null; if (stopLive) stopLive(); }
  }

  function startLive() {
    stopLive = API.listen('order:new', (d) => { toast(`Order ${d.orderNumber} saved — see it in Settings › My orders`); if (isOpen() && tab === 'orders') loadOrders(); });
    const stop2 = API.listen('order:status', (d) => { toast(`Order ${d.orderNumber} is now ${d.status}`); if (isOpen() && tab === 'orders') loadOrders(); });
    const stop1 = stopLive; stopLive = () => { stop1(); stop2(); };
  }

  // ── panel ──
  const isOpen = () => panel && panel.classList.contains('open');
  function build() {
    ov = document.createElement('div'); ov.className = 'dt-ov'; ov.onclick = close;
    panel = document.createElement('aside'); panel.className = 'dt-panel'; panel.setAttribute('aria-label', 'Settings');
    panel.innerHTML = `
      <div class="dt-head"><div class="dt-av" id="dtAv"></div><div class="dt-who"><b id="dtName"></b><span id="dtMail"></span></div><button class="dt-x" aria-label="Close" type="button"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="dt-tabs"><button class="dt-tab on" data-t="orders" type="button"><i class="fa-solid fa-bag-shopping"></i> My orders</button><button class="dt-tab" data-t="profile" type="button"><i class="fa-solid fa-user"></i> Profile</button></div>
      <div class="dt-body" id="dtBody"></div>
      <div class="dt-foot"><a class="dt-btn ghost" id="dtAdmin" style="display:none" href="#"><i class="fa-solid fa-gauge"></i> Admin dashboard</a><button class="dt-btn out" id="dtLogout" type="button"><i class="fa-solid fa-right-from-bracket"></i> Log out</button></div>`;
    document.body.append(ov, panel);
    panel.querySelector('.dt-x').onclick = close;
    panel.querySelectorAll('.dt-tab').forEach((b) => b.onclick = () => setTab(b.dataset.t));
    panel.querySelector('#dtLogout').onclick = logout;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  }
  function fillHead() {
    const u = API.user() || {};
    panel.querySelector('#dtAv').textContent = initials(u);
    panel.querySelector('#dtName').textContent = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    panel.querySelector('#dtMail').textContent = u.email || '';
    const a = panel.querySelector('#dtAdmin'); a.style.display = u.role === 'admin' ? '' : 'none'; a.href = API.base + '/admin.html';
  }
  function open() { if (!panel) build(); fillHead(); setTab(tab); requestAnimationFrame(() => { ov.classList.add('open'); panel.classList.add('open'); }); }
  function close() { if (panel) { panel.classList.remove('open'); ov.classList.remove('open'); } }
  function logout() { API.logout(); close(); if (stopLive) stopLive(); location.reload(); }
  function setTab(t) {
    tab = t;
    panel.querySelectorAll('.dt-tab').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    t === 'orders' ? loadOrders() : showProfile();
  }

  // ── purchase history ──
  const pillClass = (s) => ({ delivered: 'ok', confirmed: 'ok', paid: 'ok', cancelled: 'bad', failed: 'bad', pending: 'warn', unpaid: 'warn' }[s] || '');
  async function loadOrders() {
    const body = panel.querySelector('#dtBody');
    body.innerHTML = '<div class="dt-empty"><i class="fa-solid fa-circle-notch fa-spin"></i>Loading your orders…</div>';
    try {
      const { orders } = await API.myOrders();
      if (!orders.length) { body.innerHTML = '<div class="dt-empty"><i class="fa-solid fa-bag-shopping"></i>You have not bought anything yet.<br>Your purchases will appear here.</div>'; return; }
      body.innerHTML = orders.map(orderCard).join('');
      body.querySelectorAll('[data-cancel]').forEach((b) => b.onclick = () => cancel(b.dataset.cancel));
      body.querySelectorAll('[data-ref]').forEach((b) => b.onclick = () => sendRef(b));
    } catch (e) { body.innerHTML = `<div class="dt-empty"><i class="fa-solid fa-triangle-exclamation"></i>${esc(e.message)}</div>`; }
  }
  function orderCard(o) {
    const pay = o.payment || {};
    const canCancel = o.status === 'pending' && o.paymentStatus === 'unpaid';
    const needsPay = o.paymentStatus === 'unpaid' && o.status !== 'cancelled' && o.paymentMethod !== 'cash-on-delivery' && pay._id;
    return `<div class="dt-order">
      <div class="dt-row"><span class="no">${esc(o.orderNumber)}</span><span class="dt-pill ${pillClass(o.status)}">${esc(o.status)}</span></div>
      <div class="dt-m">${when(o.createdAt)} · Payment: <span class="dt-pill ${pillClass(o.paymentStatus)}">${esc(o.paymentStatus)}</span></div>
      <ul class="dt-items">${o.items.map((i) => `<li>${i.image ? `<img src="${esc(API.imageUrl(i))}" alt="" onerror="this.style.visibility='hidden'">` : ''}<span>${esc(i.name)}</span><span class="q">${i.quantity} × ${frw(i.price)}</span></li>`).join('')}</ul>
      <div class="dt-total"><span>Total</span><span>${frw(o.total)}</span></div>
      <details><summary>Order progress</summary><ul>${(o.statusHistory || []).map((h) => `<li><b style="text-transform:capitalize">${esc(h.status)}</b> · ${when(h.at)}${h.note ? ' — ' + esc(h.note) : ''}</li>`).join('')}</ul></details>
      ${needsPay ? `<div class="dt-act">${pay.reference
        ? `<span class="dt-m">MoMo code sent: <b>${esc(pay.reference)}</b> — waiting for confirmation.</span>`
        : `<input class="dt-in" placeholder="MoMo transaction ID" aria-label="MoMo transaction ID"><button class="dt-btn sm" data-ref="${esc(pay._id)}" type="button">I have paid</button>`}</div>` : ''}
      ${canCancel ? `<div class="dt-act"><button class="dt-btn ghost sm" data-cancel="${esc(o._id)}" type="button">Cancel order</button></div>` : ''}
    </div>`;
  }
  async function cancel(id) {
    if (!confirm('Cancel this order?')) return;
    try { await API.cancelOrder(id); toast('Order cancelled'); loadOrders(); } catch (e) { toast(e.message); }
  }
  async function sendRef(btn) {
    const input = btn.parentElement.querySelector('input');
    try { await API.sendMoMoReference(btn.dataset.ref, input.value.trim()); toast('Thank you! We will confirm your payment shortly.'); loadOrders(); } catch (e) { toast(e.message); }
  }

  // ── profile ──
  function showProfile() {
    const u = API.user() || {};
    const body = panel.querySelector('#dtBody');
    body.innerHTML = `<form class="dt-form" id="dtForm">
      <div class="dt-2"><div><label>First name</label><input name="firstName" required value="${esc(u.firstName)}"></div><div><label>Last name</label><input name="lastName" required value="${esc(u.lastName)}"></div></div>
      <label>Phone / WhatsApp</label><input name="phone" value="${esc(u.phone)}">
      <label>Delivery address</label><input name="address" value="${esc(u.address)}" placeholder="Street, sector, district">
      <label>City</label><input name="city" value="${esc(u.city)}">
      <p class="dt-m" style="margin-top:12px">These details are used as the delivery information on your orders.</p>
      <div class="dt-note" id="dtNote"></div>
      <button class="dt-btn" style="margin-top:8px">Save changes</button></form>`;
    body.querySelector('#dtForm').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target, note = body.querySelector('#dtNote');
      try { await API.updateProfile(Object.fromEntries(['firstName', 'lastName', 'phone', 'address', 'city'].map((k) => [k, f.elements[k].value]))); fillHead(); note.style.color = '#3ddc97'; note.textContent = 'Saved.'; }
      catch (err) { note.style.color = '#ff8c8c'; note.textContent = err.message; }
    };
  }

  // contact form: fill in what we already know
  function prefill() {
    const u = API.user(); if (!u) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el && !el.value && v) el.value = v; };
    set('inputName', `${u.firstName || ''} ${u.lastName || ''}`.trim()); set('inputEmail', u.email); set('inputPhone', u.phone);
  }

  window.DalaAccount = { open, close, toast };
  function init() {
    render(); prefill();
    // confirm the saved session is still valid; if it expired, DalaAPI clears it and the Sign In link comes back
    if (API.isLoggedIn()) API.me().then(() => { render(); prefill(); }).catch(() => render());
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
